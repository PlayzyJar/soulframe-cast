import React, { useState } from 'react';
import UploadZone from '../components/UploadZone';
import SettingsPanel from '../components/SettingsPanel';

export default function ConverterView() {
  const [file, setFile] = useState(null);
  const [settings, setSettings] = useState({
    resolution: '128x64',
    fps: 15,
    dithering: 'floyd-steinberg'
  });

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full max-w-6xl mx-auto">
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="text-3xl font-extrabold uppercase tracking-tighter">Media</h2>
        <UploadZone onFileSelect={handleFileSelect} />
        {file && (
          <div className="p-4 border-4 border-foreground shadow-brutal bg-accent/20 font-mono mt-4 flex items-center justify-between">
            <div>
              <span className="font-bold uppercase block text-sm mb-1">Selected File:</span> 
              <span className="truncate block max-w-xs sm:max-w-md">{file.name}</span>
            </div>
            <div className="text-right">
              <span className="font-bold uppercase block text-sm mb-1">Size:</span> 
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>
        )}
      </div>
      <div className="w-full lg:w-96 flex flex-col gap-4">
        <h2 className="text-3xl font-extrabold uppercase tracking-tighter">Configuration</h2>
        <SettingsPanel settings={settings} onSettingsChange={setSettings} />
        
        <button 
          className="mt-4 px-8 py-4 bg-accent text-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-brutal"
          disabled={!file}
        >
          Convert Media
        </button>
      </div>
    </div>
  );
}
