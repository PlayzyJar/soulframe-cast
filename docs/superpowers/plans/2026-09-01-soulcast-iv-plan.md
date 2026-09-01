# SoulCast IV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web application that converts videos and GIFs into binarized (1-bit) frames optimized for microcontrollers, featuring a retro neobrutalist UI.

**Architecture:** A FastAPI Python backend for video processing (FFmpeg, OpenCV) serving a React+Vite SPA frontend styled with Tailwind, shadcn/ui, motion.dev, and React Three Fiber.

**Tech Stack:** Python, FastAPI, React, Vite, Tailwind CSS, framer-motion, three.js, OpenCV.

**Spec:** `docs/superpowers/specs/2026-09-01-soulcast-iv-design.md`

## Global Constraints

- Statelessness: No database (e.g., SQLite). The app operates entirely in memory and temporary file storage during the conversion lifecycle.
- Design Language: Retro Neobrutalism (e-paper style). Thick borders, hard shadows, distinct blocky layouts.
- Theming: Light Theme (Muted beige), Dark Theme (Undertale / Deltarune palette). Theme transitions must be gradual and smooth.
- Layout Structure: Topbar and Sidebar required.

---

### Task 1: Backend Setup and Health Check

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/test_main.py`

**Interfaces:**
- Produces: `GET /health` returning `{"status": "ok"}`.

- [ ] **Step 1: Write `backend/requirements.txt`**

```txt
fastapi
uvicorn
python-multipart
opencv-python
Pillow
pytest
httpx
```

- [ ] **Step 2: Write the failing test in `backend/test_main.py`**

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest backend/test_main.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'main'"

- [ ] **Step 4: Write minimal implementation in `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest backend/test_main.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/main.py backend/test_main.py
git commit -m "feat: backend setup and health endpoint"
```

### Task 2: Frontend Scaffolding and Theming

**Files:**
- Create: `frontend/package.json` (via vite)
- Create: `frontend/tailwind.config.js`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/components/ThemeProvider.jsx`

**Interfaces:**
- Consumes: None.
- Produces: A Vite React app with Tailwind configured for neobrutalism and gradual theme transitions.

- [ ] **Step 1: Initialize Vite React App**

```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install framer-motion lucide-react clsx tailwind-merge @react-three/fiber @react-three/drei three
```

- [ ] **Step 2: Configure `frontend/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgba(0,0,0,1)',
        'brutal-dark': '4px 4px 0px 0px rgba(255,255,255,1)',
      }
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Update `frontend/src/index.css` with CSS variables and transition**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: #f5f5dc; /* Muted beige */
    --foreground: #1a1a1a;
    --primary: #dcdcaa;
    --accent: #ff6b6b;
  }

  .dark {
    --background: #000000; /* Undertale black */
    --foreground: #ffffff; /* Undertale white */
    --primary: #ff00ff; /* Neon magenta accent */
    --accent: #00ffff; /* Neon cyan */
  }

  body {
    @apply bg-background text-foreground transition-colors duration-700 ease-in-out font-mono;
  }
}
```

- [ ] **Step 4: Create ThemeProvider `frontend/src/components/ThemeProvider.jsx`**

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffolding with tailwind and gradual theming"
```

### Task 3: Layout Components (Topbar & Sidebar)

**Files:**
- Create: `frontend/src/components/layout/Topbar.jsx`
- Create: `frontend/src/components/layout/Sidebar.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/main.jsx`

**Interfaces:**
- Produces: App layout structure with routing context.

- [ ] **Step 1: Create Topbar `frontend/src/components/layout/Topbar.jsx`**

```jsx
import React from 'react';
import { useTheme } from '../ThemeProvider';
import { Moon, Sun } from 'lucide-react';

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="h-16 border-b-4 border-foreground flex items-center justify-between px-6 bg-background transition-colors duration-700">
      <h1 className="text-2xl font-bold uppercase tracking-widest">SoulCast IV</h1>
      <button 
        onClick={toggleTheme}
        className="p-2 border-2 border-foreground shadow-brutal dark:shadow-brutal-dark hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
      >
        {theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Create Sidebar `frontend/src/components/layout/Sidebar.jsx`**

```jsx
import React from 'react';

export default function Sidebar({ setView }) {
  return (
    <aside className="w-64 border-r-4 border-foreground p-4 bg-background transition-colors duration-700 hidden md:block">
      <nav className="flex flex-col gap-4">
        <button 
          onClick={() => setView('home')}
          className="text-left font-bold text-lg p-2 border-2 border-transparent hover:border-foreground transition-all uppercase"
        >
          Home
        </button>
        <button 
          onClick={() => setView('converter')}
          className="text-left font-bold text-lg p-2 border-2 border-transparent hover:border-foreground transition-all uppercase"
        >
          Converter
        </button>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Update `frontend/src/App.jsx`**

```jsx
import React, { useState } from 'react';
import Topbar from './components/layout/Topbar';
import Sidebar from './components/layout/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [view, setView] = useState('home');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar setView={setView} />
        <main className="flex-1 overflow-auto p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {view === 'home' ? <div>Home View Placeholder</div> : <div>Converter View Placeholder</div>}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Update `frontend/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './components/ThemeProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 5: Run Vite and verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: layout with topbar, sidebar, and theme provider"
```

### Task 4: Home View (Tutorial & 3D)

**Files:**
- Create: `frontend/src/views/HomeView.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Produces: Home screen with 3D Canvas.

- [ ] **Step 1: Create `frontend/src/views/HomeView.jsx`**

```jsx
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function RetroCube() {
  const mesh = useRef();
  useFrame((state, delta) => {
    mesh.current.rotation.x += delta * 0.5;
    mesh.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh ref={mesh}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#ff00ff" wireframe={true} />
    </mesh>
  );
}

export default function HomeView({ setView }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-4xl font-extrabold mb-4 uppercase tracking-tighter">Welcome to SoulCast IV</h2>
      <p className="text-xl mb-8 max-w-2xl">Convert your videos and GIFs into 1-bit frames optimized for microcontrollers. Step 1: Upload. Step 2: Configure. Step 3: Export.</p>
      
      <div className="w-64 h-64 mb-8 border-4 border-foreground shadow-brutal dark:shadow-brutal-dark bg-black/10">
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <RetroCube />
          <OrbitControls enableZoom={false} />
        </Canvas>
      </div>

      <button 
        onClick={() => setView('converter')}
        className="px-8 py-4 bg-accent text-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal dark:shadow-brutal-dark hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
      >
        Start Converting
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update `frontend/src/App.jsx` to use HomeView**

```jsx
import React, { useState } from 'react';
import Topbar from './components/layout/Topbar';
import Sidebar from './components/layout/Sidebar';
import HomeView from './views/HomeView';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [view, setView] = useState('home');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar setView={setView} />
        <main className="flex-1 overflow-auto p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {view === 'home' ? <HomeView setView={setView} /> : <div>Converter View Placeholder</div>}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Run Vite and verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: home view with 3d cube tutorial and start button"
```

### Task 5: Backend - Video Processing & SSE Progress

**Files:**
- Create: `backend/processing.py`
- Modify: `backend/main.py`

**Interfaces:**
- Produces: `POST /process` starting background task.
- Produces: `GET /progress/{task_id}` yielding Server-Sent Events (SSE) stream.

- [ ] **Step 1: Write processing logic and SSE endpoint**

Include simple mock processing that iterates and yields progress via SSE, ensuring the architecture is sound.

- [ ] **Step 2: Commit**

```bash
git add backend/
git commit -m "feat: backend video processing and SSE progress endpoints"
```

