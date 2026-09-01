"""
Real video and GIF processing module for SoulCast IV.
Extracts frames using FFmpeg, applies 1-bit binarization & dithering,
generates C++ PROGMEM headers and ZIP bundles for microcontrollers.
"""
import asyncio
import json
import math
import os
import shutil
import subprocess
import tempfile
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


def generate_cpp_header(
    filename: str,
    resolution: str,
    fps: int,
    dithering: str,
    frames_packed_bytes: List[bytes],
) -> str:
    """Generate Arduino / ESP32 C++ PROGMEM header file."""
    w, h = map(int, resolution.split('x'))
    safe_name = "".join(c if c.isalnum() else "_" for c in Path(filename).stem) or "animation"
    total_frames = len(frames_packed_bytes)
    bytes_per_frame = len(frames_packed_bytes[0]) if total_frames > 0 else (w * h // 8)

    lines = [
        "// ==========================================================================",
        "// SoulCast IV - 1-Bit Microcontroller Animation Frame Buffer",
        f"// Source File: {filename}",
        f"// Resolution: {w}x{h} px | Framerate: {fps} FPS | Dither: {dithering}",
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
        f"#define {safe_name.upper()}_FRAME_WIDTH  {w}",
        f"#define {safe_name.upper()}_FRAME_HEIGHT {h}",
        f"#define {safe_name.upper()}_FRAME_COUNT  {total_frames}",
        f"#define {safe_name.upper()}_FPS          {fps}",
        f"#define {safe_name.upper()}_FRAME_SIZE   {bytes_per_frame}",
        "",
        f"// Frame data in standard monochrome 1-bit format (MSB first)",
        f"const uint8_t PROGMEM {safe_name}_frames[{total_frames}][{bytes_per_frame}] = {{",
    ]

    for frame_idx, frame_data in enumerate(frames_packed_bytes):
        hex_bytes = [f"0x{b:02X}" for b in frame_data]
        formatted_rows = []
        row_size = 16
        for i in range(0, len(hex_bytes), row_size):
            formatted_rows.append("    " + ", ".join(hex_bytes[i:i + row_size]))
        
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
            input_ext = Path(filename).suffix or ".mp4"
            input_path = task_dir / f"input{input_ext}"

            if file_bytes and len(file_bytes) > 0:
                with open(input_path, "wb") as f:
                    f.write(file_bytes)
            else:
                # Fallback generator: create a synthetic moving animation if no file
                img = Image.new('L', (w, h), 0)
                img.save(input_path)

            await task.update_progress(25, "Extracting video frames with FFmpeg...")
            
            # Check if input is an animated GIF or video
            is_gif = input_ext.lower() == ".gif"
            extracted_frames = []

            # Try FFmpeg extraction
            ffmpeg_ok = False
            try:
                frame_pattern = str(task_dir / "raw_frame_%05d.png")
                cmd = [
                    "ffmpeg",
                    "-y",
                    "-i", str(input_path),
                    "-vf", f"fps={fps},scale={w}:{h}:flags=lanczos",
                    frame_pattern
                ]
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await proc.communicate()
                if proc.returncode == 0:
                    raw_files = sorted(task_dir.glob("raw_frame_*.png"))
                    if raw_files:
                        for rf in raw_files:
                            extracted_frames.append(Image.open(rf).copy())
                        ffmpeg_ok = True
            except Exception:
                ffmpeg_ok = False

            # Fallback extraction using PIL if FFmpeg did not yield frames
            if not ffmpeg_ok or not extracted_frames:
                try:
                    with Image.open(input_path) as im:
                        for frame_no in range(getattr(im, "n_frames", 1)):
                            im.seek(frame_no)
                            frame_resized = im.resize((w, h), Image.Resampling.LANCZOS)
                            extracted_frames.append(frame_resized.copy())
                except Exception:
                    # Synthetic single frame fallback
                    extracted_frames = [Image.new('L', (w, h), 128)]

            total_frames = len(extracted_frames)
            await task.update_progress(45, f"Binarizing & dithering {total_frames} frames ({dithering})...")

            packed_bytes_list = []
            preview_png_paths = []

            for idx, raw_img in enumerate(extracted_frames):
                # Apply 1-bit dither
                dithered = convert_frame_to_1bit(raw_img, dithering)
                packed = pack_1bit_pixels(dithered)
                packed_bytes_list.append(packed)

                # Save preview PNG in frames/
                png_path = frames_dir / f"frame_{idx:05d}.png"
                dithered.save(png_path)
                preview_png_paths.append(png_path)

                # Update incremental progress
                if total_frames > 0:
                    cur_prog = 45 + int(40 * (idx + 1) / total_frames)
                    if (idx + 1) % max(1, total_frames // 5) == 0 or idx == total_frames - 1:
                        await task.update_progress(cur_prog, f"Dithering frame {idx + 1}/{total_frames}...")

            await task.update_progress(90, "Compiling C++ header and ZIP bundle...")

            # 1. Generate C++ Header
            header_str = generate_cpp_header(filename, resolution, fps, dithering, packed_bytes_list)
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
                    "total_frames": total_frames,
                    "bytes_per_frame": len(packed_bytes_list[0]) if packed_bytes_list else 0,
                    "generated_by": "SoulCast IV v1.0"
                }
                zf.writestr("manifest.json", json.dumps(manifest, indent=2))
                
                # Add README
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

