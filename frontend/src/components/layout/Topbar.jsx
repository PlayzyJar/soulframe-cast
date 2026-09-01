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
