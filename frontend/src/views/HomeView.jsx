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
