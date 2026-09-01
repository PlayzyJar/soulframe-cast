import React from 'react';

export default function ProgressBar({ progress, stage, error }) {
  return (
    <div className="flex flex-col gap-4 w-full p-6 border-4 border-foreground shadow-brutal bg-background">
      <div className="flex justify-between items-end uppercase font-mono font-bold tracking-tight">
        <span className="truncate mr-4">{error ? 'Error' : stage || 'Initializing...'}</span>
        <span className="text-2xl">{progress}%</span>
      </div>
      <div className="w-full h-10 border-4 border-foreground bg-accent/20 overflow-hidden relative">
        <div 
          className={`h-full border-r-4 border-foreground transition-all duration-300 ease-linear ${error ? 'bg-red-500' : 'bg-accent'}`}
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.25) 50%)', backgroundSize: '100% 4px' }}></div>
      </div>
      {error && (
        <div className="mt-2 text-red-600 font-bold uppercase text-sm border-2 border-red-600 p-2 bg-red-100 font-mono break-all">
          {error}
        </div>
      )}
    </div>
  );
}
