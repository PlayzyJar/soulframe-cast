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
