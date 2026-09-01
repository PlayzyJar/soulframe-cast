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
