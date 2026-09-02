import json
import pytest
import httpx
from fastapi.testclient import TestClient
from main import app
from processing import task_manager

client = TestClient(app)


def test_read_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_start_processing_endpoint():
    response = client.post("/process", json={"filename": "gameplay.mp4", "step_delay": 0.001})
    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    assert data["status"] == "started"
    assert data["message"] == "Processing started"


def test_start_processing_empty_body():
    response = client.post("/process")
    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    assert data["status"] == "started"


def test_get_progress_not_found():
    response = client.get("/progress/unknown-id-12345")
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_get_task_status_endpoint():
    post_res = client.post("/process", json={"filename": "test.mp4", "step_delay": 0.05})
    task_id = post_res.json()["task_id"]

    res = client.get(f"/tasks/{task_id}")
    assert res.status_code == 200
    task_data = res.json()
    assert task_data["task_id"] == task_id
    assert "progress" in task_data


def test_get_task_status_not_found():
    res = client.get("/tasks/non-existent-task-id")
    assert res.status_code == 404


def test_progress_sse_stream():
    post_res = client.post("/process", json={"filename": "stream_test.mp4", "step_delay": 0.005})
    task_id = post_res.json()["task_id"]

    with client.stream("GET", f"/progress/{task_id}") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                raw = line[6:].strip()
                if raw:
                    events.append(json.loads(raw))

        assert len(events) >= 1
        for ev in events:
            assert "progress" in ev
            assert "status" in ev


@pytest.mark.anyio
async def test_async_sse_stream_realtime():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        post_res = await ac.post("/process", json={"filename": "async_test.mp4", "step_delay": 0.01})
        assert post_res.status_code == 200
        task_id = post_res.json()["task_id"]

        async with ac.stream("GET", f"/progress/{task_id}") as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

            events = []
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    raw = line[6:].strip()
                    if raw:
                        events.append(json.loads(raw))

            assert len(events) >= 1
            assert events[-1]["status"] == "completed"
            assert events[-1]["progress"] == 100


def test_start_processing_multipart():
    # Simulate a binary video file upload with byte values including high/non-utf8 bytes
    binary_content = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00\xe4\x85g\x01\x8b\xff"
    files = {"file": ("test_video.mp4", binary_content, "video/mp4")}
    data = {"settings": json.dumps({"resolution": "128x64", "fps": 15, "dithering": "floyd-steinberg"})}
    response = client.post("/process", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()
    assert "task_id" in res_data
    assert res_data["status"] == "started"

    # Verify task payload stored the filename and options
    task = task_manager.get_task(res_data["task_id"])
    assert task is not None
    assert task.payload["filename"] == "test_video.mp4"
    assert task.payload["options"]["resolution"] == "128x64"


def test_preview_endpoint_rgb565():
    from io import BytesIO
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (64, 64), (255, 0, 0)).save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/preview",
        files={"file": ("test.png", buf.getvalue(), "image/png")},
        data={
            "timestamp_sec": "0.0",
            "settings": json.dumps({"resolution": "64x64", "color_mode": "rgb565", "dithering": "none"}),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "preview_image" in data
    assert data["preview_image"].startswith("data:image/png;base64,")
    assert data["bytes_per_frame"] == 64 * 64 * 2  # 8192 bytes
    assert data["color_mode"] == "rgb565"
    assert data["resolution"] == "64x64"
    assert data["formatted_frame_size"] == "8.0 KB"
    assert data["timestamp_sec"] == 0.0


def test_preview_endpoint_monochrome():
    from io import BytesIO
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (128, 64), (255, 255, 255)).save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/preview",
        files={"file": ("test.png", buf.getvalue(), "image/png")},
        data={
            "timestamp_sec": "1.5",
            "settings": json.dumps({"resolution": "128x64", "color_mode": "monochrome", "dithering": "floyd-steinberg"}),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "preview_image" in data
    assert data["preview_image"].startswith("data:image/png;base64,")
    assert data["bytes_per_frame"] == 16 * 64  # 1024 bytes
    assert data["color_mode"] == "monochrome"
    assert data["resolution"] == "128x64"
    assert data["formatted_frame_size"] == "1.0 KB"
    assert data["timestamp_sec"] == 1.5


def test_preview_endpoint_grayscale():
    from io import BytesIO
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (64, 64), (128, 128, 128)).save(buf, format="PNG")
    buf.seek(0)

    response = client.post(
        "/preview",
        files={"file": ("test.png", buf.getvalue(), "image/png")},
        data={
            "timestamp_sec": "2.0",
            "settings": json.dumps({"resolution": "64x64", "color_mode": "grayscale", "dithering": "none"}),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "preview_image" in data
    assert data["preview_image"].startswith("data:image/png;base64,")
    assert data["bytes_per_frame"] == 64 * 64  # 4096 bytes
    assert data["color_mode"] == "grayscale"
    assert data["resolution"] == "64x64"
    assert data["formatted_frame_size"] == "4.0 KB"
    assert data["timestamp_sec"] == 2.0


def test_preview_endpoint_no_file():
    response = client.post("/preview")
    assert response.status_code in (400, 422)


