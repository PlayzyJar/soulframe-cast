# SoulCast IV - Design Specification

## Goal
Build a local web application that converts videos and GIFs into binarized (1-bit) frames optimized for microcontrollers. The application will run entirely locally, remaining stateless (no database), and provide an interactive, high-quality UI/UX with 3D elements and advanced animations.

## Architecture & Stack
**Backend (Stateless API):**
- **Python + FastAPI:** High-performance async API for serving the frontend and handling conversion requests. Includes Server-Sent Events (SSE) for real-time progress updates.
- **FFmpeg:** For extracting frames from video/GIF uploads.
- **OpenCV / NumPy / Pillow:** For high-speed image processing and dithering algorithms (Threshold, Otsu, Floyd-Steinberg, Atkinson, Bayer).

**Frontend (SPA served by Backend):**
- **React + Vite:** For building a robust, reactive interface.
- **Tailwind CSS + shadcn/ui:** For styling and accessible, reusable UI components.
- **motion.dev (Framer Motion):** For smooth layout transitions, gradual theme switching, and sophisticated animations.
- **React Three Fiber (Three.js):** For rendering 3D animated models on the Home screen.

## Global Constraints & UI/UX Guidelines
1. **Statelessness:** No database (e.g., SQLite). The app operates entirely in memory and temporary file storage during the conversion lifecycle.
2. **Design Language:** **Retro Neobrutalism (e-paper style)**.
   - Thick borders, hard shadows, distinct blocky layouts similar to the provided reference images.
3. **Theming:**
   - **Light Theme:** Muted beige / e-paper aesthetic.
   - **Dark Theme:** Undertale / Deltarune palette (stark black backgrounds, white outlines, and selective neon/pixel accents).
   - Theme transitions must be gradual and smooth (managed via motion.dev/CSS transitions), replicating the UX from the `edge-computing-llm` reference project.
4. **Layout Structure:**
   - **Topbar:** For global actions, theme toggling, and future Google Login integration (v2).
   - **Sidebar:** For navigation between Home, Converter, and future sections.

## Application Flow & Views

### 1. Home View (Landing / Tutorial)
- **Introduction:** Brief explanation of the app's purpose.
- **3D Animated Tutorial:** Uses React Three Fiber to display 3D models and interactive steps explaining the conversion workflow.
- **Call-to-Action (CTA):** A highly visible, neobrutalist button to start the conversion process, navigating the user to the Converter View.

### 2. Converter View
- **Upload Area:** Drag-and-drop zone for `.mp4`, `.mkv`, `.webm`, or `.gif`.
- **Settings Panel:**
   - Resolution presets (128x64, 128x32, 64x48) + Custom.
   - FPS control (5 - 30).
   - Resize mode (Fit/Letterbox vs Crop).
   - Processing sliders (Brightness, Contrast, Gamma, Invert).
   - Dithering algorithm selector.
- **Live Preview Canvas:** Allows the user to seek a sample frame from the uploaded media and view the 1-bit binarized result in real-time.
- **Conversion Progress:** A real-time progress bar and log (fed by SSE) showing the current state of the video processing.
- **Export Action:** Generates a `.zip` with the frames and an optional `.h` C/C++ array file, initiating a download.

## Execution Model
- The app will have a single entry point (e.g., `run.sh` / `run.bat`) that installs dependencies, builds the Vite frontend, and starts the FastAPI server to serve both the static React files and the API endpoints.
