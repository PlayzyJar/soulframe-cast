You are implementing Task 2: Backend Integration & SSE

## Task Description
Wire the frontend `ConverterView` to the backend API (`POST /process` and `GET /progress/{task_id}`).

Requirements:
1. Update `ConverterView.jsx` to have a "Start Conversion" button that sends the selected file and settings via `fetch` as `multipart/form-data` to `http://localhost:8000/process`.
2. Upon receiving a `task_id`, switch the UI to a "Processing" state.
3. Implement an `EventSource` to listen to `http://localhost:8000/progress/{task_id}`.
4. Build a retro Progress Bar component (`ProgressBar.jsx`) that displays the percentage and current stage (e.g., "Extracting frames...", "Applying dither...") using the SSE data.
5. Handle the "COMPLETED" and "FAILED" events from the stream to end the processing state.

Work strictly in `c:\Users\Elias\OneDrive\Documentos\GitHub\soulframe-cast\.worktrees\implementacao`.
