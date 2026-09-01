import React from 'react';
import { useTheme } from '../ThemeProvider';
import { Moon, Sun } from 'lucide-react';

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="h-16 border-b-4 border-foreground flex items-center justify-between px-6 bg-background transition-colors duration-700 shrink-0">
      <h1 className="text-2xl font-bold uppercase tracking-widest hidden md:block text-foreground">SoulCast IV</h1>
      <div className="flex-1 md:hidden">
        {/* Mobile Spacer / Mobile Title */}
        <h1 className="text-xl font-bold uppercase tracking-widest text-foreground">SoulCast IV</h1>
      </div>
      <button 
        onClick={toggleTheme}
        className="p-2 border-2 border-foreground bg-accent text-foreground shadow-brutal dark:shadow-brutal-dark hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon size={24} strokeWidth={2.5}/> : <Sun size={24} strokeWidth={2.5}/>}
      </button>
    </header>
  );
}
