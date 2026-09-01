# SoulCast IV - Phase 2: Converter Interface & Integration

## Objective
Build the actual Converter UI, connecting the frontend to the FastAPI backend's SSE endpoints to upload, configure, and convert videos to 1-bit frames.

## Architecture

The `ConverterView` will be a multi-step component (or a dashboard) with three main sections:
1. **Upload Area**: Drag & Drop zone for videos/GIFs.
2. **Settings Panel**: Controls for Resolution (128x64, etc.), FPS, and Dithering algorithm.
3. **Progress & Export Area**: A live progress bar fueled by Server-Sent Events (SSE) from the backend, and download buttons (ZIP / C++ Header) when finished.

## Tasks

### Task 1: Upload & Settings UI
**Goal**: Build the UI components for file selection and configuration.
- `UploadZone.jsx`: Drag and drop file input, validating video formats.
- `SettingsPanel.jsx`: Form controls for target resolution, FPS, and binarization threshold/dither.

### Task 2: Backend Integration & SSE
**Goal**: Wire the frontend to the backend `POST /process` and `GET /progress/{task_id}`.
- Create `api.js` in frontend to handle the FormData upload.
- Implement an `EventSource` listener in the UI to update a retro progress bar in real-time.

### Task 3: Export & Preview
**Goal**: Handle the final converted result.
- Mock the return of a ZIP file download.
- Display a small "success" animation or a preview frame of the 1-bit video.
