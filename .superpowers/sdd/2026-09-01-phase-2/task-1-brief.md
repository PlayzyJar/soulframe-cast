You are implementing Task 1: Upload & Settings UI

## Task Description
Build the UI components for file selection and configuration in the Converter View.

Global constraints:
- Use Tailwind CSS and the existing Retro Neobrutalism design language (thick borders, hard shadows: `shadow-brutal`).
- Ensure it works with the dark/light mode setup (use `bg-background`, `text-foreground`, `border-foreground`, etc).

Requirements:
1. Create `frontend/src/views/ConverterView.jsx`. Replace the placeholder in `App.jsx` with this component.
2. Inside `ConverterView`, build a two-column or split layout:
   - Left/Top: Drag & Drop zone (`UploadZone.jsx`) for videos. A big dashed/solid border box to select files.
   - Right/Bottom: Settings Panel (`SettingsPanel.jsx`) with a form for: Resolution (e.g., dropdown for 128x64, 256x128), FPS (number input), and Dithering algorithm (toggle/select).
3. Connect the components to a local state in `ConverterView` holding the selected file and settings.

Do not implement the actual backend API calls yet. Just the UI.

Work strictly in `c:\Users\Elias\OneDrive\Documentos\GitHub\soulframe-cast\.worktrees\implementacao`.
