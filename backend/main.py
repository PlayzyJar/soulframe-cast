import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from processing import (
    ProcessRequest,
    ProcessResponse,
    task_manager,
)

app = FastAPI(title="SoulCast IV API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/process", response_model=ProcessResponse)
async def start_processing(
    background_tasks: BackgroundTasks,
    request: Optional[ProcessRequest] = None,
):
    req = request or ProcessRequest()
    task = task_manager.create_task(req.model_dump())
    delay = req.step_delay if req.step_delay is not None else 0.05
    background_tasks.add_task(task_manager.run_mock_processing, task, step_delay=delay)

    return ProcessResponse(
        task_id=task.task_id,
        status="started",
        message="Processing started",
    )


@app.get("/progress/{task_id}")
async def get_progress(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return StreamingResponse(
        task_manager.subscribe_progress(task_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.to_dict()
