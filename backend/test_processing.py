import asyncio
import json
from unittest.mock import patch
import pytest
from processing import Task, TaskManager, TaskStatus


@pytest.mark.anyio
async def test_task_lifecycle():
    task = Task(task_id="test-123", payload={"filename": "demo.mp4"})
    assert task.task_id == "test-123"
    assert task.status == TaskStatus.PENDING
    assert task.progress == 0
    assert task.stage == "Queued"

    # Update progress
    await task.update_progress(progress=50, stage="Analyzing", status=TaskStatus.PROCESSING)
    assert task.progress == 50
    assert task.stage == "Analyzing"
    assert task.status == TaskStatus.PROCESSING

    task_dict = task.to_dict()
    assert task_dict["task_id"] == "test-123"
    assert task_dict["progress"] == 50
    assert task_dict["stage"] == "Analyzing"
    assert task_dict["payload"] == {"filename": "demo.mp4"}


@pytest.mark.anyio
async def test_task_manager_mock_processing():
    tm = TaskManager()
    task = tm.create_task({"filename": "quick.mp4"})
    assert task.task_id in tm.tasks

    # Run mock processing with 0 delay for fast test
    await tm.run_mock_processing(task, step_delay=0)

    assert task.status == TaskStatus.COMPLETED
    assert task.progress == 100
    assert task.stage == "Processing complete"
    assert task.result is not None
    assert task.result.get("output_url") == f"/outputs/{task.task_id}.mp4"


@pytest.mark.anyio
async def test_task_manager_mock_processing_error_handling():
    tm = TaskManager()
    task = tm.create_task({"filename": "error.mp4"})

    # Patch asyncio.sleep to raise an exception during run_mock_processing
    with patch("asyncio.sleep", side_effect=RuntimeError("Simulated processing failure")):
        await tm.run_mock_processing(task, step_delay=0.1)

    assert task.status == TaskStatus.FAILED
    assert task.error == "Simulated processing failure"
    assert task.stage == "Processing error"


@pytest.mark.anyio
async def test_task_manager_subscribe_progress_active():
    tm = TaskManager()
    task = tm.create_task({"filename": "stream.mp4"})

    async def consumer():
        events = []
        async for sse_event in tm.subscribe_progress(task.task_id):
            assert sse_event.startswith("data: ")
            assert sse_event.endswith("\n\n")
            raw_data = sse_event.replace("data: ", "").strip()
            data = json.loads(raw_data)
            events.append(data)
        return events

    consumer_task = asyncio.create_task(consumer())

    # Let consumer register initial state
    await asyncio.sleep(0.01)

    # Run processing
    await tm.run_mock_processing(task, step_delay=0.001)

    events = await consumer_task
    assert len(events) >= 6
    assert events[0]["status"] == "pending"
    assert events[-1]["status"] == "completed"
    assert events[-1]["progress"] == 100


@pytest.mark.anyio
async def test_task_manager_multiple_subscribers():
    tm = TaskManager()
    task = tm.create_task({"filename": "multi.mp4"})

    async def consumer():
        events = []
        async for sse_event in tm.subscribe_progress(task.task_id):
            raw_data = sse_event.replace("data: ", "").strip()
            events.append(json.loads(raw_data))
        return events

    consumer_1 = asyncio.create_task(consumer())
    consumer_2 = asyncio.create_task(consumer())

    await asyncio.sleep(0.01)
    await tm.run_mock_processing(task, step_delay=0.001)

    events_1 = await consumer_1
    events_2 = await consumer_2

    assert len(events_1) == len(events_2)
    assert events_1[-1]["progress"] == 100
    assert events_2[-1]["progress"] == 100


@pytest.mark.anyio
async def test_task_manager_subscribe_progress_already_completed():
    tm = TaskManager()
    task = tm.create_task({"filename": "done.mp4"})
    await tm.run_mock_processing(task, step_delay=0)

    events = []
    async for sse_event in tm.subscribe_progress(task.task_id):
        data = json.loads(sse_event.replace("data: ", "").strip())
        events.append(data)

    assert len(events) == 1
    assert events[0]["status"] == "completed"
    assert events[0]["progress"] == 100


@pytest.mark.anyio
async def test_task_manager_subscribe_nonexistent():
    tm = TaskManager()
    events = []
    async for sse_event in tm.subscribe_progress("non-existent"):
        events.append(sse_event)
    assert len(events) == 0


@pytest.mark.anyio
async def test_real_processing_240x240():
    from pathlib import Path
    tm = TaskManager()
    task = tm.create_task()
    
    # Run real processing with 240x240 resolution (fallback generator produces test frame)
    await tm.run_real_processing(
        task=task,
        file_bytes=None,
        filename="test_smartwatch.mp4",
        options={"resolution": "240x240", "fps": 10, "dithering": "floyd-steinberg"}
    )

    assert task.status == TaskStatus.COMPLETED
    assert task.progress == 100
    assert task.result is not None
    assert task.result["resolution"] == "240x240"
    assert task.result["bytes_per_frame"] == (240 * 240) // 8  # 7200 bytes
    assert Path(task.result["header_path"]).exists()
    assert Path(task.result["zip_path"]).exists()


def test_pack_rgb565_pixels():
    from PIL import Image
    from processing import pack_rgb565_pixels
    # Red pixel (255, 0, 0) in RGB565 Big-Endian is 0xF800
    img = Image.new("RGB", (2, 2), (255, 0, 0))
    packed, sim_img = pack_rgb565_pixels(img)
    assert len(packed) == 2 * 2 * 2  # 4 pixels * 2 bytes = 8 bytes
    # First pixel 0xF800 in Big-Endian is [0xF8, 0x00]
    assert packed[0] == 0xF8 and packed[1] == 0x00
    assert packed == b"\xF8\x00" * 4
    assert sim_img.size == (2, 2)
    assert sim_img.mode == "RGB"
    # Red pixel simulated: (255, 0, 0)
    assert sim_img.getpixel((0, 0)) == (255, 0, 0)


def test_pack_grayscale_pixels():
    from PIL import Image
    from processing import pack_grayscale_pixels
    img = Image.new("RGB", (2, 2), (128, 128, 128))
    packed, sim_img = pack_grayscale_pixels(img)
    assert len(packed) == 4  # 4 pixels * 1 byte
    assert packed[0] == 128
    assert packed == b"\x80\x80\x80\x80"
    assert sim_img.size == (2, 2)
    assert sim_img.mode == "L"


def test_convert_frame_by_mode():
    from PIL import Image
    from processing import convert_frame_by_mode
    img = Image.new("RGB", (2, 2), (255, 0, 0))

    # RGB565
    packed_rgb, sim_rgb = convert_frame_by_mode(img, "rgb565", "none")
    assert len(packed_rgb) == 8
    assert packed_rgb[:2] == b"\xF8\x00"

    # Grayscale
    packed_gray, sim_gray = convert_frame_by_mode(img, "grayscale", "none")
    assert len(packed_gray) == 4

    # Monochrome
    packed_mono, sim_mono = convert_frame_by_mode(img, "monochrome", "none")
    # For 2x2 image, packed into bytes horizontally: each row is 2 pixels = 1 byte packed
    assert len(packed_mono) == 2


def test_cpp_header_rgb565():
    from processing import generate_cpp_header
    frames_data = [b"\xF8\x00" * 4]  # 4 pixels of RGB565
    header = generate_cpp_header("test.mp4", "2x2", 10, "none", "rgb565", frames_data)
    assert "COLOR_MODE_RGB565" in header
    assert "const uint16_t PROGMEM test_frames[1][4] = {" in header
    assert "0xF800" in header
    assert "DRAW_FRAME" in header


def test_cpp_header_grayscale():
    from processing import generate_cpp_header
    frames_data = [b"\x80" * 4]  # 4 pixels of Grayscale
    header = generate_cpp_header("test.mp4", "2x2", 10, "none", "grayscale", frames_data)
    assert "COLOR_MODE_GRAYSCALE" in header
    assert "const uint8_t PROGMEM test_frames[1][4] = {" in header
    assert "0x80" in header


@pytest.mark.anyio
async def test_real_processing_rgb565():
    from pathlib import Path
    tm = TaskManager()
    task = tm.create_task()

    await tm.run_real_processing(
        task=task,
        file_bytes=None,
        filename="test_color.mp4",
        options={"resolution": "10x10", "fps": 5, "color_mode": "rgb565"}
    )

    assert task.status == TaskStatus.COMPLETED
    assert task.progress == 100
    assert task.result is not None
    assert task.result["color_mode"] == "rgb565"
    assert task.result["bytes_per_frame"] == 10 * 10 * 2
    assert Path(task.result["header_path"]).exists()
    assert Path(task.result["zip_path"]).exists()


def test_pack_rgb565_primary_colors():
    from PIL import Image
    from processing import pack_rgb565_pixels

    # Green (0, 255, 0) -> 0x07E0
    green_img = Image.new("RGB", (1, 1), (0, 255, 0))
    packed, sim = pack_rgb565_pixels(green_img)
    assert packed == b"\x07\xE0"
    assert sim.getpixel((0, 0)) == (0, 255, 0)

    # Blue (0, 0, 255) -> 0x001F
    blue_img = Image.new("RGB", (1, 1), (0, 0, 255))
    packed, sim = pack_rgb565_pixels(blue_img)
    assert packed == b"\x00\x1F"
    assert sim.getpixel((0, 0)) == (0, 0, 255)

    # White (255, 255, 255) -> 0xFFFF
    white_img = Image.new("RGB", (1, 1), (255, 255, 255))
    packed, sim = pack_rgb565_pixels(white_img)
    assert packed == b"\xFF\xFF"
    assert sim.getpixel((0, 0)) == (255, 255, 255)

    # Black (0, 0, 0) -> 0x0000
    black_img = Image.new("RGB", (1, 1), (0, 0, 0))
    packed, sim = pack_rgb565_pixels(black_img)
    assert packed == b"\x00\x00"
    assert sim.getpixel((0, 0)) == (0, 0, 0)


def test_cpp_header_backward_compatibility():
    from processing import generate_cpp_header
    frames_data = [b"\x00" * 16]
    # Called with 5 positional arguments (original signature without color_mode)
    header = generate_cpp_header("test_legacy.mp4", "16x8", 10, "floyd-steinberg", frames_data)
    assert "COLOR_MODE_MONOCHROME" in header
    assert "const uint8_t PROGMEM test_legacy_frames[1][16] = {" in header



