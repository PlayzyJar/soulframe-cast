import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function CmdHeart() {
  const group = useRef();
  
  useFrame((state) => {
    if (group.current) {
      group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  const heartPixels = [
    [0,1,1,0,1,1,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
  ];

  const pixelSize = 0.2;
  const offsetX = (7 * pixelSize) / 2 - (pixelSize / 2);
  const offsetY = (6 * pixelSize) / 2 - (pixelSize / 2);

  return (
    <group ref={group}>
      {/* CMD Window Body */}
      <mesh position={[0, 0, -0.2]}>
        <boxGeometry args={[3.2, 2.4, 0.1]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      
      {/* CMD Top Bar */}
      <mesh position={[0, 1.1, -0.15]}>
        <boxGeometry args={[3.2, 0.3, 0.1]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Terminal Text lines (decorations) */}
      <mesh position={[-1.2, 0.8, -0.1]}>
        <boxGeometry args={[0.5, 0.05, 0.1]} />
        <meshStandardMaterial color="#00ff00" />
      </mesh>
      <mesh position={[-1.0, 0.6, -0.1]}>
        <boxGeometry args={[0.9, 0.05, 0.1]} />
        <meshStandardMaterial color="#00ff00" />
      </mesh>
      
      {/* 8-bit Heart */}
      <group position={[0, -0.2, 0.1]}>
        {heartPixels.map((row, y) => 
          row.map((pixel, x) => {
            if (pixel === 1) {
              return (
                <mesh key={`${x}-${y}`} position={[x * pixelSize - offsetX, -y * pixelSize + offsetY, 0]}>
                  <boxGeometry args={[pixelSize, pixelSize, 0.1]} />
                  <meshStandardMaterial color="#d48b99" />
                </mesh>
              )
            }
            return null;
          })
        )}
      </group>
    </group>
  );
}

export default function HomeView({ setView }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-4xl font-extrabold mb-4 uppercase tracking-tighter">Welcome to SoulCast IV</h2>
      <p className="text-xl mb-8 max-w-2xl">Convert your videos and GIFs into 1-bit frames optimized for microcontrollers. Step 1: Upload. Step 2: Configure. Step 3: Export.</p>
      
      <div className="w-64 h-64 mb-8 border-4 border-foreground shadow-brutal bg-black/10">
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <CmdHeart />
          <OrbitControls enableZoom={false} />
        </Canvas>
      </div>

      <button 
        onClick={() => setView('converter')}
        className="px-8 py-4 bg-accent text-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
      >
        Start Converting
      </button>
    </div>
  );
}
