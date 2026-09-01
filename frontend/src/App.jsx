import React, { useState } from 'react';
import Topbar from './components/layout/Topbar';
import Sidebar from './components/layout/Sidebar';
import HomeView from './views/HomeView';
import ConverterView from './views/ConverterView';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [view, setView] = useState('home');
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background transition-colors duration-700 font-mono">
      <Sidebar setView={setView} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} activeView={view} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
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
              {view === 'home' ? <HomeView setView={setView} /> : <ConverterView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
