#!/usr/bin/env bash
set -e

echo "==================================================="
echo "            SOULCAST IV - LAUNCHER"
echo "==================================================="
echo ""

# 1. Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 could not be found!"
    echo "Please install Python 3.10+ using your package manager."
    exit 1
fi

# 2. Check Node / npm
if ! command -v npm &>/dev/null; then
    echo "[ERROR] npm / nodejs could not be found!"
    echo "Please install Node.js 18+ (e.g., sudo apt install nodejs npm)."
    exit 1
fi

# 3. Check FFmpeg
if ! command -v ffmpeg &>/dev/null; then
    echo "[WARNING] ffmpeg not found in PATH!"
    echo "Video conversion requires FFmpeg (e.g., sudo apt install ffmpeg / brew install ffmpeg)."
    echo ""
fi

# 4. Backend Setup
if [ ! -d "backend/venv" ]; then
    echo "[*] Creating virtual environment in backend/venv..."
    python3 -m venv backend/venv
fi

echo "[*] Activating venv and installing requirements..."
source backend/venv/bin/activate
pip install --upgrade pip >/dev/null 2>&1 || true
pip install -r backend/requirements.txt

# 5. Frontend Setup
if [ ! -d "frontend/node_modules" ]; then
    echo "[*] Installing frontend dependencies..."
    (cd frontend && npm install)
fi

# 6. Launch
echo ""
echo "==================================================="
echo " Starting Backend on http://localhost:8000"
echo " Starting Frontend on http://localhost:5173"
echo "==================================================="
echo "Press Ctrl+C to stop both services."
echo ""

# Handle graceful shutdown
cleanup() {
    echo ""
    echo "[*] Stopping SoulCast IV services..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
python -m uvicorn main:app --reload --port 8000 --app-dir backend &
BACKEND_PID=$!

# Start frontend in foreground
cd frontend
npm run dev -- --host