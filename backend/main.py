import asyncio
import json
import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse

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
    request: Request,
    background_tasks: BackgroundTasks,
):
    content_type = request.headers.get("content-type", "")
    filename = "video.mp4"
    options = {}
    step_delay = 0.0
    file_bytes: Optional[bytes] = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if uploaded_file and hasattr(uploaded_file, "filename") and uploaded_file.filename:
            filename = uploaded_file.filename
            file_bytes = await uploaded_file.read()

        settings_raw = form.get("settings")
        if settings_raw:
            try:
                if isinstance(settings_raw, str):
                    options = json.loads(settings_raw)
                elif isinstance(settings_raw, dict):
                    options = settings_raw
            except Exception:
                pass
    elif "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                filename = body.get("filename", filename)
                options = body.get("options", options)
                step_delay = body.get("step_delay", step_delay)
        except Exception:
            pass

    payload = {
        "filename": filename,
        "options": options,
        "step_delay": step_delay,
    }

    task = task_manager.create_task(payload)
    
    # If a specific step_delay > 0 is passed in JSON without real file, allow mock for tests
    if file_bytes is None and step_delay > 0 and not options:
        background_tasks.add_task(task_manager.run_mock_processing, task, step_delay=step_delay)
    else:
        background_tasks.add_task(
            task_manager.run_real_processing,
            task,
            file_bytes=file_bytes,
            filename=filename,
            options=options,
        )

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


@app.get("/download/{task_id}/header")
async def download_header(task_id: str):
    task = task_manager.get_task(task_id)
    if not task or not task.result or "header_path" not in task.result:
        raise HTTPException(status_code=404, detail="Header file not found or task still processing")
    
    header_path = Path(task.result["header_path"])
    if not header_path.exists():
        raise HTTPException(status_code=404, detail="Header file not found on disk")
    
    return FileResponse(
        path=str(header_path),
        media_type="text/x-c++hdr",
        filename=header_path.name,
    )


@app.get("/download/{task_id}/zip")
async def download_zip(task_id: str):
    task = task_manager.get_task(task_id)
    if not task or not task.result or "zip_path" not in task.result:
        raise HTTPException(status_code=404, detail="ZIP bundle not found or task still processing")
    
    zip_path = Path(task.result["zip_path"])
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="ZIP file not found on disk")
    
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=zip_path.name,
    )
