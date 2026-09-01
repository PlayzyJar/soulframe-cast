"""
Video processing and task management module for SoulCast IV.
Handles background task scheduling, progress tracking, and SSE streaming.
"""
import asyncio
import json
import uuid
from enum import Enum
from typing import Any, AsyncGenerator, Dict, Optional
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessRequest(BaseModel):
    filename: Optional[str] = Field(default="video.mp4", description="Source video file name or path")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Processing configuration options")
    step_delay: Optional[float] = Field(default=0.05, description="Delay between processing stages in seconds (for mock/simulation)")


class ProcessResponse(BaseModel):
    task_id: str
    status: str = "started"
    message: str = "Processing started"


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

        # Broadcast to all active SSE subscribers
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

    def create_task(self, payload: Optional[Dict[str, Any]] = None) -> Task:
        task_id = str(uuid.uuid4())
        task = Task(task_id, payload)
        self.tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.tasks.get(task_id)

    async def run_mock_processing(self, task: Task, step_delay: float = 0.05) -> None:
        """Simulate a multi-stage video processing pipeline."""
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

        # If already done, yield current state and finish immediately
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
