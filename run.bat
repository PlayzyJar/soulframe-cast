@echo off
setlocal enabledelayedexpansion
title SoulCast IV - Automated Launcher

echo ===================================================
echo             SOULCAST IV - LAUNCHER
echo ===================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found in PATH!
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

:: 2. Check Node.js / npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm / Node.js not found in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: 3. Check FFmpeg (Warning only)
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] ffmpeg not found in PATH!
    echo Video frame extraction requires FFmpeg.
    echo Tip: Run "winget install Gyan.FFmpeg" in another terminal.
    echo.
)

:: 4. Backend Virtual Environment Setup
if not exist "backend\venv" (
    echo [*] Creating Python virtual environment in backend\venv...
    python -m venv backend\venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo [*] Activating virtual environment and installing backend requirements...
call backend\venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul 2>nul
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b 1
)

:: 5. Frontend Setup
if not exist "frontend\node_modules" (
    echo [*] Installing frontend npm dependencies...
    cd frontend
    call npm install
    cd ..
)

:: 6. Launch Applications
echo.
echo ===================================================
echo  Starting Backend on http://localhost:8000
echo  Starting Frontend on http://localhost:5173
echo ===================================================
echo.

:: Start backend in a separate minimized or background window
start "SoulCast IV - Backend" cmd /c "call backend\venv\Scripts\activate.bat && cd backend && uvicorn main:app --reload --port 8000"

:: Wait 2 seconds and launch frontend
timeout /t 2 /nobreak >nul
echo [*] Launching Frontend...
cd frontend
call npm run dev