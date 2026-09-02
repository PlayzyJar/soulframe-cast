"""
Real video and GIF processing module for SoulCast IV.
Extracts frames using FFmpeg, applies 1-bit binarization & dithering,
generates C++ PROGMEM headers and ZIP bundles for microcontrollers.
"""
import asyncio
import base64
import io
import json
import math
import os
import shutil
import subprocess
import tempfile
import threading
import uuid
import zipfile
from enum import Enum
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

import numpy as np
from PIL import Image
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessRequest(BaseModel):
    filename: Optional[str] = Field(default="video.mp4", description="Source video file name")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Processing configuration options")
    step_delay: Optional[float] = Field(default=0.0, description="Delay between processing stages in seconds")


class ProcessResponse(BaseModel):
    task_id: str
    status: str = "started"
    message: str = "Processing started"


BAYER_4X4 = np.array([
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
], dtype=np.float32) / 16.0 * 255.0


def apply_bayer_dither(img: Image.Image) -> Image.Image:
    """Apply 4x4 Bayer ordered dithering to a grayscale PIL image."""
    img_gray = img.convert('L')
    arr = np.array(img_gray, dtype=np.float32)
    h, w = arr.shape
    
    # Tile Bayer matrix across image
    reps_y = math.ceil(h / 4)
    reps_x = math.ceil(w / 4)
    bayer_tiled = np.tile(BAYER_4X4, (reps_y, reps_x))[:h, :w]
    
    # Dither thresholding (1 = white, 0 = black)
    binary = (arr >= bayer_tiled).astype(np.uint8) * 255
    return Image.fromarray(binary, mode='L').convert('1', dither=Image.Dither.NONE)


def convert_frame_to_1bit(img: Image.Image, dithering_mode: str = "floyd-steinberg") -> Image.Image:
    """Convert an image to 1-bit monochrome using specified dither algorithm."""
    img_gray = img.convert('L')
    mode = str(dithering_mode or "").lower()

    if "bayer" in mode:
        return apply_bayer_dither(img_gray)
    elif "none" in mode or "threshold" in mode:
        return img_gray.convert('1', dither=Image.Dither.NONE)
    else:
        # Default to Floyd-Steinberg error diffusion
        return img_gray.convert('1', dither=Image.Dither.FLOYDSTEINBERG)


def pack_1bit_pixels(img_1bit: Image.Image) -> bytes:
    """
    Pack 1-bit image into horizontal bytes (MSB first, 8 pixels per byte).
    Standard Adafruit GFX / SSD1306 monochrome bitmap format.
    """
    arr = np.array(img_1bit, dtype=np.uint8)
    # Boolean array: True if white (1), False if black (0)
    bool_arr = arr > 0
    # Pack along horizontal axis (axis=1)
    packed = np.packbits(bool_arr, axis=1)
    return packed.tobytes()


def pack_rgb565_pixels(img: Image.Image) -> tuple[bytes, Image.Image]:
    """
    Pack RGB PIL Image into 16-bit Big-Endian RGB565 format (uint16_t).
    Also generates a simulated 16-bit quantized RGB Image for preview/export.
    """
    if img.mode != "RGB":
        img = img.convert("RGB")
    arr = np.array(img, dtype=np.uint16)
    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]

    # Calculate 16-bit RGB565: ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
    rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
    packed_bytes = rgb565.astype(">u2").tobytes()

    # Generate simulated 16-bit quantized RGB Image for preview/export:
    sim_r = ((r >> 3) * 255 // 31).astype(np.uint8)
    sim_g = ((g >> 2) * 255 // 63).astype(np.uint8)
    sim_b = ((b >> 3) * 255 // 31).astype(np.uint8)
    sim_img = Image.fromarray(np.stack([sim_r, sim_g, sim_b], axis=-1), mode="RGB")

    return packed_bytes, sim_img


def pack_grayscale_pixels(img: Image.Image) -> tuple[bytes, Image.Image]:
    """
    Pack PIL Image into 8-bit Grayscale format.
    Extract raw bytes img.tobytes() (length = W * H).
    Returns (packed_bytes, grayscale_image).
    """
    img_gray = img.convert("L")
    return img_gray.tobytes(), img_gray


def convert_frame_by_mode(
    img: Image.Image,
    color_mode: str = "monochrome",
    dithering: str = "floyd-steinberg"
) -> tuple[bytes, Image.Image]:
    """
    Unified frame converter supporting RGB565, Grayscale, and Monochrome.
    """
    mode = str(color_mode or "monochrome").lower()
    if mode == "rgb565":
        return pack_rgb565_pixels(img.convert("RGB"))
    elif mode == "grayscale":
        return pack_grayscale_pixels(img)
    else:
        dithered = convert_frame_to_1bit(img, dithering)
        packed = pack_1bit_pixels(dithered)
        return packed, dithered


def format_frame_size(num_bytes: int) -> str:
    """Format byte count into human-readable string (e.g. 112.5 KB, 1.0 KB, 512 B)."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        val = num_bytes / 1024
        return f"{val:.1f} KB"
    else:
        val = num_bytes / (1024 * 1024)
        return f"{val:.1f} MB"


def extract_preview_frame(
    file_bytes: Optional[bytes] = None,
    filename: str = "video.mp4",
    timestamp_sec: float = 0.0,
    resolution: str = "128x64",
    color_mode: str = "monochrome",
    dithering: str = "floyd-steinberg",
) -> Dict[str, Any]:
    """
    Extracts a single frame at timestamp_sec from video or image/GIF bytes,
    processes it according to color_mode and dithering, and returns
    a Base64 data URL with hardware frame metrics.
    """
    try:
        w, h = map(int, resolution.split('x'))
    except Exception:
        w, h = 128, 64
        resolution = "128x64"

    try:
        timestamp_sec = float(timestamp_sec)
    except (ValueError, TypeError):
        timestamp_sec = 0.0

    mode = str(color_mode or "monochrome").lower()
    dither_mode = str(dithering or "floyd-steinberg").lower()

    # Calculate bytes_per_frame
    if mode == "rgb565":
        bytes_per_frame = w * h * 2
    elif mode == "grayscale":
        bytes_per_frame = w * h
    else:
        mode = "monochrome"
        bytes_per_frame = math.ceil(w / 8) * h

    formatted_size = format_frame_size(bytes_per_frame)

    raw_frame: Optional[Image.Image] = None

    with tempfile.TemporaryDirectory(prefix="soulcast_preview_") as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        ext = Path(filename).suffix or ".mp4"
        input_path = temp_dir / f"input{ext}"
        out_frame_path = temp_dir / "preview_frame.png"

        if file_bytes and len(file_bytes) > 0:
            with open(input_path, "wb") as f:
                f.write(file_bytes)
        else:
            # Fallback blank image
            raw_frame = Image.new("RGB", (w, h), (128, 128, 128))

        if raw_frame is None:
            # 1. Attempt FFmpeg fast seek
            cmd = [
                "ffmpeg",
                "-y",
                "-ss", str(timestamp_sec),
                "-i", str(input_path),
                "-vframes", "1",
                "-vf", f"scale={w}:{h}:flags=lanczos",
                str(out_frame_path),
            ]
            try:
                subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=5,
                )
            except Exception:
                pass

            if out_frame_path.exists() and out_frame_path.stat().st_size > 0:
                try:
                    with Image.open(out_frame_path) as im:
                        raw_frame = im.convert("RGB")
                except Exception:
                    raw_frame = None

        # 2. Fallback to PIL Image.open (for animated GIF or image files or if FFmpeg fails)
        if raw_frame is None and input_path.exists() and input_path.stat().st_size > 0:
            try:
                with Image.open(input_path) as im:
                    n_frames = getattr(im, "n_frames", 1)
                    if n_frames > 1:
                        frame_duration_ms = im.info.get("duration", 100) or 100
                        target_frame = int((timestamp_sec * 1000) / frame_duration_ms)
                        frame_idx = min(max(0, target_frame), n_frames - 1)
                        im.seek(frame_idx)
                    raw_frame = im.convert("RGB").resize((w, h), Image.Resampling.LANCZOS)
            except Exception:
                pass

        if raw_frame is None:
            raw_frame = Image.new("RGB", (w, h), (0, 0, 0))

        # Convert frame using unified converter
        _, converted_img = convert_frame_by_mode(raw_frame, mode, dither_mode)

        # Encode to PNG base64
        buf = io.BytesIO()
        converted_img.save(buf, format="PNG")
        b64_str = base64.b64encode(buf.getvalue()).decode("ascii")
        preview_data_url = f"data:image/png;base64,{b64_str}"

        return {
            "preview_image": preview_data_url,
            "resolution": resolution,
            "color_mode": mode,
            "bytes_per_frame": bytes_per_frame,
            "formatted_frame_size": formatted_size,
            "timestamp_sec": timestamp_sec,
        }


def generate_cpp_header(
    filename: str,
    resolution: str,
    fps: int,
    dithering: str,
    color_mode: Any = "monochrome",
    frames_packed_bytes: Optional[List[bytes]] = None,
) -> str:
    """Generate Arduino / ESP32 C++ PROGMEM header file for RGB565, Grayscale, or Monochrome."""
    if isinstance(color_mode, list):
        frames_packed_bytes = color_mode
        color_mode = "monochrome"

    frames_packed_bytes = frames_packed_bytes or []
    mode = str(color_mode or "monochrome").lower()
    w, h = map(int, resolution.split('x'))
    safe_name = "".join(c if c.isalnum() else "_" for c in Path(filename).stem) or "animation"
    total_frames = len(frames_packed_bytes)

    if mode == "rgb565":
        bytes_per_frame = len(frames_packed_bytes[0]) if total_frames > 0 else (w * h * 2)
        total_elements = w * h
        type_str = "uint16_t"
    elif mode == "grayscale":
        bytes_per_frame = len(frames_packed_bytes[0]) if total_frames > 0 else (w * h)
        total_elements = w * h
        type_str = "uint8_t"
    else:
        mode = "monochrome"
        bytes_per_frame = len(frames_packed_bytes[0]) if total_frames > 0 else (w * h // 8)
        total_elements = bytes_per_frame
        type_str = "uint8_t"

    lines = [
        "// ==========================================================================",
        f"// SoulCast IV - Microcontroller Animation Frame Buffer ({mode.upper()})",
        f"// Source File: {filename}",
        f"// Resolution: {w}x{h} px | Framerate: {fps} FPS | Mode: {mode} | Dither: {dithering}",
        f"// Total Frames: {total_frames} | Bytes per Frame: {bytes_per_frame} bytes",
        f"// Total Memory: {total_frames * bytes_per_frame} bytes",
        "// ==========================================================================",
        f"#ifndef SOULCAST_{safe_name.upper()}_H",
        f"#define SOULCAST_{safe_name.upper()}_H",
        "",
        "#include <stdint.h>",
        "#ifdef __AVR__",
        "  #include <avr/pgmspace.h>",
        "#elif defined(ESP8266) || defined(ESP32)",
        "  #include <pgmspace.h>",
        "#else",
        "  #define PROGMEM",
        "#endif",
        "",
        f"#define {safe_name.upper()}_WIDTH         {w}",
        f"#define {safe_name.upper()}_HEIGHT        {h}",
        f"#define {safe_name.upper()}_FRAME_WIDTH   {w}",
        f"#define {safe_name.upper()}_FRAME_HEIGHT  {h}",
        f"#define {safe_name.upper()}_FRAME_COUNT   {total_frames}",
        f"#define {safe_name.upper()}_FPS           {fps}",
        f"#define {safe_name.upper()}_FRAME_SIZE    {bytes_per_frame}",
    ]

    if mode == "rgb565":
        lines.append("#define COLOR_MODE_RGB565")
        lines.append(
            f"#define DRAW_FRAME(tft, frame_idx) tft.pushImage(0, 0, {safe_name.upper()}_WIDTH, {safe_name.upper()}_HEIGHT, (uint16_t*){safe_name}_frames[frame_idx])"
        )
        lines.append("")
        lines.append("// Frame data in 16-bit Big-Endian RGB565 format")
    elif mode == "grayscale":
        lines.append("#define COLOR_MODE_GRAYSCALE")
        lines.append("")
        lines.append("// Frame data in 8-bit grayscale format (0-255)")
    else:
        lines.append("#define COLOR_MODE_MONOCHROME")
        lines.append("")
        lines.append("// Frame data in standard monochrome 1-bit format (MSB first)")

    lines.append(f"const {type_str} PROGMEM {safe_name}_frames[{total_frames}][{total_elements}] = {{")

    for frame_idx, frame_data in enumerate(frames_packed_bytes):
        if mode == "rgb565":
            vals = np.frombuffer(frame_data, dtype=">u2")
            hex_items = [f"0x{int(v):04X}" for v in vals]
        else:
            hex_items = [f"0x{b:02X}" for b in frame_data]

        formatted_rows = []
        row_size = 16
        for i in range(0, len(hex_items), row_size):
            formatted_rows.append("    " + ", ".join(hex_items[i:i + row_size]))

        comma = "," if frame_idx < total_frames - 1 else ""
        lines.append(f"  // --- Frame {frame_idx} ---")
        lines.append("  {")
        lines.append(",\n".join(formatted_rows))
        lines.append(f"  }}{comma}")

    lines.extend([
        "};",
        "",
        f"#endif // SOULCAST_{safe_name.upper()}_H",
        ""
    ])

    return "\n".join(lines)


class Task:
    def __init__(self, task_id: str, payload: Optional[Dict[str, Any]] = None):
        self.task_id = task_id
        self.payload = payload or {}
        self.status = TaskStatus.PENDING
        self.progress = 0
        self.stage = "Queued"
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.subscribers: list[asyncio.Queue] = []
        self._done_event = asyncio.Event()

    async def update_progress(
        self,
        progress: int,
        stage: str = "",
        status: TaskStatus = TaskStatus.PROCESSING,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        self.progress = progress
        self.stage = stage
        self.status = status
        self.result = result
        self.error = error

        event_data = {
            "task_id": self.task_id,
            "progress": self.progress,
            "stage": self.stage,
            "status": str(self.status.value if isinstance(self.status, TaskStatus) else self.status),
        }
        if result is not None:
            event_data["result"] = result
        if error is not None:
            event_data["error"] = error

        for sub in list(self.subscribers):
            await sub.put(event_data)

        if status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
            self._done_event.set()

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "task_id": self.task_id,
            "progress": self.progress,
            "stage": self.stage,
            "status": str(self.status.value if isinstance(self.status, TaskStatus) else self.status),
            "payload": self.payload,
        }
        if self.result is not None:
            data["result"] = self.result
        if self.error is not None:
            data["error"] = self.error
        return data


class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.storage_dir = Path(tempfile.gettempdir()) / "soulcast_storage"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def create_task(self, payload: Optional[Dict[str, Any]] = None) -> Task:
        task_id = str(uuid.uuid4())
        task = Task(task_id, payload)
        self.tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.tasks.get(task_id)

    def extract_preview_frame(
        self,
        file_bytes: Optional[bytes] = None,
        filename: str = "video.mp4",
        timestamp_sec: float = 0.0,
        resolution: str = "128x64",
        color_mode: str = "monochrome",
        dithering: str = "floyd-steinberg",
    ) -> Dict[str, Any]:
        return extract_preview_frame(
            file_bytes=file_bytes,
            filename=filename,
            timestamp_sec=timestamp_sec,
            resolution=resolution,
            color_mode=color_mode,
            dithering=dithering,
        )

    async def run_real_processing(
        self,
        task: Task,
        file_bytes: Optional[bytes] = None,
        filename: str = "video.mp4",
        options: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Full real video processing pipeline using FFmpeg and Pillow."""
        options = options or {}
        resolution = options.get("resolution", "128x64")
        fps = int(options.get("fps", 15))
        dithering = options.get("dithering", "floyd-steinberg")
        color_mode = options.get("color_mode", "monochrome")

        try:
            w, h = map(int, resolution.split('x'))
        except Exception:
            w, h = 128, 64
            resolution = "128x64"

        task_dir = self.storage_dir / task.task_id
        task_dir.mkdir(parents=True, exist_ok=True)

        frames_dir = task_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)

        try:
            await task.update_progress(10, "Saving uploaded media...")
            await asyncio.sleep(0)
            input_ext = Path(filename).suffix or ".mp4"
            input_path = task_dir / f"input{input_ext}"

            if file_bytes and len(file_bytes) > 0:
                with open(input_path, "wb") as f:
                    f.write(file_bytes)
            else:
                input_path = task_dir / "input.png"
                img = Image.new('RGB', (w, h), (128, 128, 128))
                img.save(input_path)

            estimated_total_frames = int(options.get("total_frames", 0) or options.get("estimated_total_frames", 0))
            if estimated_total_frames <= 0:
                try:
                    with Image.open(input_path) as im:
                        if getattr(im, "n_frames", 1) > 1:
                            estimated_total_frames = im.n_frames
                except Exception:
                    pass

            await task.update_progress(10, "Extracting video frames with FFmpeg...")
            await asyncio.sleep(0)

            frame_pattern = task_dir / "raw_frame_%05d.png"
            cmd = [
                "ffmpeg",
                "-y",
                "-i", str(input_path),
                "-vf", f"fps={fps},scale={w}:{h}:flags=lanczos",
                "-progress", "pipe:1",
                str(frame_pattern),
            ]

            loop = asyncio.get_running_loop()
            progress_queue: asyncio.Queue = asyncio.Queue()

            def ffmpeg_worker():
                try:
                    proc = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        bufsize=1,
                        encoding="utf-8",
                        errors="ignore",
                    )
                except Exception as exc:
                    loop.call_soon_threadsafe(progress_queue.put_nowait, ("error", str(exc)))
                    return

                stderr_lines = []

                def read_stderr():
                    try:
                        for err_line in proc.stderr:
                            stderr_lines.append(err_line)
                    except Exception:
                        pass

                stderr_thread = threading.Thread(target=read_stderr, daemon=True)
                stderr_thread.start()

                try:
                    for line in proc.stdout:
                        line = line.strip()
                        if line.startswith("frame="):
                            try:
                                frame_val = int(line.split("=")[1].strip())
                                loop.call_soon_threadsafe(
                                    progress_queue.put_nowait, ("frame", frame_val)
                                )
                            except ValueError:
                                pass
                except Exception:
                    pass

                proc.wait()
                stderr_thread.join(timeout=2)
                err_text = "".join(stderr_lines)
                loop.call_soon_threadsafe(
                    progress_queue.put_nowait, ("done", (proc.returncode, err_text))
                )

            worker = threading.Thread(target=ffmpeg_worker, daemon=True)
            worker.start()

            last_extract_prog = 10
            ffmpeg_err = ""
            while True:
                msg_type, data = await progress_queue.get()
                if msg_type == "frame":
                    current_frame = data
                    if estimated_total_frames > 0:
                        cur_prog = min(39, 10 + int(30 * (current_frame / estimated_total_frames)))
                    else:
                        cur_prog = min(39, 10 + min(29, current_frame))
                    if cur_prog > last_extract_prog or current_frame % 5 == 0:
                        last_extract_prog = cur_prog
                        await task.update_progress(cur_prog, f"Extracting frame {current_frame}...")
                        await asyncio.sleep(0)
                elif msg_type == "done":
                    retcode, ffmpeg_err = data
                    break
                elif msg_type == "error":
                    ffmpeg_err = data
                    break

            raw_files = sorted(task_dir.glob("raw_frame_*.png"))

            # Fallback to PIL extraction if ffmpeg didn't produce frames (e.g. animated GIF)
            if not raw_files:
                try:
                    with Image.open(input_path) as im:
                        n_frames = getattr(im, "n_frames", 1)
                        for frame_no in range(n_frames):
                            im.seek(frame_no)
                            frame_resized = im.resize((w, h), Image.Resampling.LANCZOS)
                            save_path = task_dir / f"raw_frame_{frame_no:05d}.png"
                            frame_resized.save(save_path)
                    raw_files = sorted(task_dir.glob("raw_frame_*.png"))
                except Exception:
                    pass

            if not raw_files:
                raise RuntimeError(f"Failed to extract video frames: {ffmpeg_err[-300:] if ffmpeg_err else 'Unknown format'}")

            total_frames = len(raw_files)
            stage_desc = (
                f"Processing {total_frames} frames (RGB565)..."
                if color_mode == "rgb565"
                else (
                    f"Processing {total_frames} frames (Grayscale)..."
                    if color_mode == "grayscale"
                    else f"Binarizing & dithering {total_frames} frames ({dithering})..."
                )
            )
            await task.update_progress(40, stage_desc)
            await asyncio.sleep(0)

            packed_bytes_list = []
            preview_png_paths = []
            last_reported_prog = 40

            for idx, raw_file_path in enumerate(raw_files):
                with Image.open(raw_file_path) as raw_img:
                    packed, preview_img = convert_frame_by_mode(raw_img, color_mode, dithering)
                    packed_bytes_list.append(packed)

                    png_path = frames_dir / f"frame_{idx:05d}.png"
                    preview_img.save(png_path)
                    preview_png_paths.append(png_path)

                cur_prog = 40 + int(50 * (idx + 1) / total_frames)
                if (
                    (idx == total_frames - 1)
                    or ((idx + 1) % 10 == 0)
                    or (cur_prog >= last_reported_prog + 5)
                ):
                    await task.update_progress(cur_prog, f"Encoding frame {idx + 1}/{total_frames} ({color_mode})...")
                    await asyncio.sleep(0)
                    last_reported_prog = cur_prog

            await task.update_progress(90, f"Compiling C++ header and ZIP bundle for {total_frames} frames...")
            await asyncio.sleep(0)

            # 1. Generate C++ Header
            header_str = generate_cpp_header(filename, resolution, fps, dithering, color_mode, packed_bytes_list)
            safe_name = "".join(c if c.isalnum() else "_" for c in Path(filename).stem) or "animation"
            header_path = task_dir / f"soulcast_{safe_name}.h"
            with open(header_path, "w", encoding="utf-8") as f:
                f.write(header_str)

            # 2. Generate ZIP Bundle
            zip_path = task_dir / f"soulcast_{safe_name}.zip"
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                # Add header
                zf.write(header_path, arcname=f"soulcast_{safe_name}.h")
                
                # Add frames
                for p in preview_png_paths:
                    zf.write(p, arcname=f"frames/{p.name}")
                
                # Add Manifest JSON
                manifest = {
                    "source": filename,
                    "resolution": resolution,
                    "fps": fps,
                    "dithering": dithering,
                    "color_mode": color_mode,
                    "total_frames": total_frames,
                    "bytes_per_frame": len(packed_bytes_list[0]) if packed_bytes_list else 0,
                    "generated_by": "SoulCast IV v1.2"
                }
                zf.writestr("manifest.json", json.dumps(manifest, indent=2))
                
                # Add README
                if color_mode == "rgb565":
                    readme_text = (
                        f"# SoulCast IV - RGB565 Color Animation Export\n\n"
                        f"- Source: {filename}\n"
                        f"- Resolution: {resolution}\n"
                        f"- Framerate: {fps} FPS\n"
                        f"- Color Mode: RGB565 (16-bit Big-Endian)\n"
                        f"- Frame Count: {total_frames}\n\n"
                        f"## How to use with TFT_eSPI (ST7789, ILI9341, GC9A01):\n"
                        f"1. Copy `soulcast_{safe_name}.h` into your sketch folder.\n"
                        f"2. Include the header: `#include \"soulcast_{safe_name}.h\"`\n"
                        f"3. Render frame: `DRAW_FRAME(tft, frame);`\n"
                    )
                elif color_mode == "grayscale":
                    readme_text = (
                        f"# SoulCast IV - Grayscale Animation Export\n\n"
                        f"- Source: {filename}\n"
                        f"- Resolution: {resolution}\n"
                        f"- Framerate: {fps} FPS\n"
                        f"- Color Mode: Grayscale (8-bit)\n"
                        f"- Frame Count: {total_frames}\n\n"
                        f"## How to use in Arduino / ESP32:\n"
                        f"1. Copy `soulcast_{safe_name}.h` into your sketch folder.\n"
                        f"2. Include the header: `#include \"soulcast_{safe_name}.h\"`\n"
                    )
                else:
                    readme_text = (
                        f"# SoulCast IV - 1-Bit Animation Export\n\n"
                        f"- Source: {filename}\n"
                        f"- Resolution: {resolution}\n"
                        f"- Framerate: {fps} FPS\n"
                        f"- Dither Algorithm: {dithering}\n"
                        f"- Frame Count: {total_frames}\n\n"
                        f"## How to use in Arduino / ESP32:\n"
                        f"1. Copy `soulcast_{safe_name}.h` into your sketch folder.\n"
                        f"2. Include the header: `#include \"soulcast_{safe_name}.h\"`\n"
                        f"3. Use with Adafruit_SSD1306: `display.drawBitmap(0, 0, {safe_name}_frames[frame], {w}, {h}, 1);`\n"
                    )
                zf.writestr("README.md", readme_text)

            result_info = {
                "header_path": str(header_path),
                "zip_path": str(zip_path),
                "total_frames": total_frames,
                "bytes_per_frame": len(packed_bytes_list[0]) if packed_bytes_list else 0,
                "resolution": resolution,
                "fps": fps,
                "dithering": dithering,
                "color_mode": color_mode,
            }

            await task.update_progress(
                progress=100,
                stage="Conversion complete!",
                status=TaskStatus.COMPLETED,
                result=result_info,
            )

        except Exception as exc:
            await task.update_progress(
                progress=task.progress,
                stage="Processing failed",
                status=TaskStatus.FAILED,
                error=str(exc),
            )

    async def run_mock_processing(self, task: Task, step_delay: float = 0.05) -> None:
        """Legacy mock processor for fast testing."""
        stages = [
            (10, "Initializing video processor"),
            (25, "Extracting audio and video frames"),
            (50, "Analyzing frames & OCR detection"),
            (75, "Generating subtitle and item overlays"),
            (90, "Encoding output video stream"),
            (100, "Processing complete"),
        ]
        try:
            for prog, stage in stages:
                if step_delay > 0:
                    await asyncio.sleep(step_delay)
                is_last = (prog == 100)
                status = TaskStatus.COMPLETED if is_last else TaskStatus.PROCESSING
                result = {"output_url": f"/outputs/{task.task_id}.mp4"} if is_last else None
                await task.update_progress(
                    progress=prog,
                    stage=stage,
                    status=status,
                    result=result,
                )
        except Exception as exc:
            await task.update_progress(
                progress=task.progress,
                stage="Processing error",
                status=TaskStatus.FAILED,
                error=str(exc),
            )

    async def subscribe_progress(self, task_id: str, timeout: float = 1.0) -> AsyncGenerator[str, None]:
        task = self.get_task(task_id)
        if not task:
            return

        if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
            yield f"data: {json.dumps(task.to_dict())}\n\n"
            return

        sub_queue: asyncio.Queue = asyncio.Queue()
        task.subscribers.append(sub_queue)

        # Yield current initial state
        yield f"data: {json.dumps(task.to_dict())}\n\n"

        try:
            while True:
                if task._done_event.is_set() and sub_queue.empty():
                    break
                try:
                    event_data = await asyncio.wait_for(sub_queue.get(), timeout=timeout)
                    yield f"data: {json.dumps(event_data)}\n\n"
                    if (
                        event_data.get("status") in (TaskStatus.COMPLETED, TaskStatus.FAILED, "completed", "failed")
                        or event_data.get("progress", 0) >= 100
                    ):
                        break
                except asyncio.TimeoutError:
                    if task._done_event.is_set():
                        break
                    continue
        finally:
            if sub_queue in task.subscribers:
                task.subscribers.remove(sub_queue)


task_manager = TaskManager()

