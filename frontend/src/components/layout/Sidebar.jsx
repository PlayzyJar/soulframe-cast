import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Home, FileVideo, PanelLeftClose } from 'lucide-react';

const PixelHeart = ({ className }) => (
  <svg width="32" height="32" viewBox="0 0 7 6" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M1,0 H3 V1 H1 Z M4,0 H6 V1 H4 Z M0,1 H7 V3 H0 Z M1,3 H6 V4 H1 Z M2,4 H5 V5 H2 Z M3,5 H4 V6 H3 Z" fill="currentColor" />
  </svg>
);

export default function Sidebar({ setView, isCollapsed, setIsCollapsed, activeView }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="border-r-4 border-foreground bg-background transition-colors duration-700 flex flex-col h-full z-10 hidden md:flex"
    >
      <div 
        className="h-16 flex items-center justify-center border-b-4 border-foreground cursor-pointer hover:bg-foreground/5 transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="relative w-8 h-8 flex items-center justify-center text-accent">
          <motion.div
            initial={false}
            animate={{ 
              rotate: isHovered ? 180 : 0, 
              opacity: isHovered ? 0 : 1,
              scale: isHovered ? 0 : 1
            }}
            transition={{ duration: 0.3 }}
            className="absolute"
          >
            <PixelHeart />
          </motion.div>
          <motion.div
            initial={false}
            animate={{ 
              rotate: isHovered ? (isCollapsed ? 180 : 0) : (isCollapsed ? 360 : -180), 
              opacity: isHovered ? 1 : 0,
              scale: isHovered ? 1 : 0
            }}
            transition={{ duration: 0.3 }}
            className="absolute text-foreground"
          >
            <PanelLeftClose size={28} strokeWidth={2.5} />
          </motion.div>
        </div>
      </div>

      <nav className="flex flex-col gap-4 p-4 mt-4">
        <SidebarItem 
          icon={<Home size={24} strokeWidth={2.5} />} 
          label="Home" 
          isActive={activeView === 'home'} 
          onClick={() => setView('home')} 
          isCollapsed={isCollapsed} 
        />
        <SidebarItem 
          icon={<FileVideo size={24} strokeWidth={2.5} />} 
          label="Converter" 
          isActive={activeView === 'converter'} 
          onClick={() => setView('converter')} 
          isCollapsed={isCollapsed} 
        />
      </nav>
    </motion.aside>
  );
}

function SidebarItem({ icon, label, isActive, onClick, isCollapsed }) {
  return (
    <button 
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={`flex items-center gap-4 font-bold text-lg border-2 uppercase transition-all whitespace-nowrap overflow-hidden
        ${isActive 
          ? 'border-foreground bg-foreground text-background shadow-brutal dark:shadow-brutal-dark hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none' 
          : 'border-transparent text-foreground hover:border-foreground hover:shadow-brutal dark:hover:shadow-brutal-dark'
        }
        ${isCollapsed ? 'justify-center w-12 h-12 rounded-none p-0 mx-auto' : 'w-full p-3'}
      `}
    >
      <div className="flex-shrink-0">{icon}</div>
      {!isCollapsed && <span>{label}</span>}
    </button>
  );
}
