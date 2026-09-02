import React from 'react';

export default function SettingsPanel({ settings, onSettingsChange }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onSettingsChange({
      ...settings,
      [name]: value
    });
  };

  return (
    <div className="flex flex-col p-6 border-4 border-foreground shadow-brutal bg-background">
      <h3 className="text-2xl font-bold uppercase mb-6 border-b-4 border-foreground pb-2">Settings</h3>
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="font-bold uppercase" htmlFor="resolution">Resolution</label>
          <select 
            id="resolution" 
            name="resolution" 
            value={settings.resolution} 
            onChange={handleChange}
            className="p-3 border-4 border-foreground bg-background text-foreground font-mono focus:outline-none focus:ring-4 focus:ring-accent appearance-none cursor-pointer"
          >
            <option value="128x64">128x64 (SSD1306 Standard)</option>
            <option value="128x32">128x32 (SSD1306 Narrow)</option>
            <option value="240x240">240x240 (ST7789 / GC9A01)</option>
            <option value="128x128">128x128 (Square 1.44")</option>
            <option value="256x128">256x128 (Wide Display)</option>
            <option value="64x32">64x32 (Mini Display)</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold uppercase" htmlFor="fps">FPS</label>
          <input 
            type="number" 
            id="fps" 
            name="fps" 
            value={settings.fps} 
            onChange={handleChange}
            min="1"
            max="60"
            className="p-3 border-4 border-foreground bg-background text-foreground font-mono focus:outline-none focus:ring-4 focus:ring-accent"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold uppercase" htmlFor="dithering">Dithering Algorithm</label>
          <select 
            id="dithering" 
            name="dithering" 
            value={settings.dithering} 
            onChange={handleChange}
            className="p-3 border-4 border-foreground bg-background text-foreground font-mono focus:outline-none focus:ring-4 focus:ring-accent appearance-none cursor-pointer"
          >
            <option value="none">None (Threshold)</option>
            <option value="floyd-steinberg">Floyd-Steinberg</option>
            <option value="bayer">Bayer (Ordered)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
