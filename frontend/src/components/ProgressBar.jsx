import React from 'react';

export default function ProgressBar({ progress = 0, stage, error }) {
  const safeProgress = Math.min(100, Math.max(0, Number(progress) || 0));

  return (
    <div className="flex flex-col gap-4 w-full p-6 border-4 border-foreground shadow-brutal bg-background">
      <div className="flex justify-between items-start gap-4 uppercase font-mono font-bold tracking-tight">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wider text-foreground/70 mb-0.5">Stage</span>
          <span className="text-base font-bold break-words leading-tight">
            {error ? 'Error' : stage || 'Initializing...'}
          </span>
        </div>
        <div className="px-3 py-1 bg-foreground text-background font-mono font-bold text-xl border-2 border-foreground shadow-brutal flex-shrink-0 self-center">
          {progress}%
        </div>
      </div>
      
      <div className="w-full h-10 border-4 border-foreground bg-accent/10 overflow-hidden relative">
        <div 
          role="progressbar"
          aria-valuenow={safeProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-full border-r-4 border-foreground transition-all duration-300 ease-out relative overflow-hidden ${
            error ? 'bg-red-500' : 'bg-accent'
          }`}
          style={{ width: `${safeProgress}%` }}
        >
          <div 
            className="absolute inset-0 opacity-30 animate-pulse pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.25) 10px, rgba(0,0,0,0.25) 20px)',
            }}
          />
        </div>
        <div 
          className="absolute inset-0 pointer-events-none opacity-20" 
          style={{ 
            backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.25) 50%)', 
            backgroundSize: '100% 4px' 
          }}
        />
      </div>

      {error && (
        <div className="mt-2 text-red-600 font-bold uppercase text-sm border-2 border-red-600 p-2 bg-red-100 font-mono break-all">
          {error}
        </div>
      )}
    </div>
  );
}
