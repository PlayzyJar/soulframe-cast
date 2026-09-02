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

