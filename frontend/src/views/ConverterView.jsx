import React, { useState, useEffect } from 'react';
import UploadZone from '../components/UploadZone';
import SettingsPanel from '../components/SettingsPanel';
import ProgressBar from '../components/ProgressBar';

export default function ConverterView() {
  const [file, setFile] = useState(null);
  const [settings, setSettings] = useState({
    resolution: '128x64',
    fps: 15,
    dithering: 'floyd-steinberg'
  });

  const [taskId, setTaskId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressData, setProgressData] = useState({ progress: 0, stage: '', error: null });

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
  };

  const startConversion = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setProgressData({ progress: 0, stage: 'Starting...', error: null });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('settings', JSON.stringify(settings));

    try {
      const response = await fetch('http://localhost:8000/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setTaskId(data.task_id);
    } catch (err) {
      setProgressData(prev => ({ ...prev, error: err.message, stage: 'Failed to start' }));
      setTaskId(null);
    }
  };

  useEffect(() => {
    if (!taskId) return;

    const eventSource = new EventSource(`http://localhost:8000/progress/${taskId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgressData({
        progress: data.progress,
        stage: data.stage,
        error: data.error
      });

      if (data.status === 'completed' || data.status === 'failed') {
        eventSource.close();
        setIsProcessing(false);
        setTaskId(null);
      }
    };

    eventSource.onerror = (err) => {
      setProgressData(prev => ({ ...prev, error: 'SSE Connection lost', stage: 'Error' }));
      eventSource.close();
      setIsProcessing(false);
      setTaskId(null);
    };

    return () => {
      eventSource.close();
    };
  }, [taskId]);

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
        
        {isProcessing || taskId || progressData.progress > 0 || progressData.error ? (
          <div className="mt-4 flex flex-col gap-4">
            <ProgressBar 
              progress={progressData.progress} 
              stage={progressData.stage} 
              error={progressData.error} 
            />
            {!isProcessing && !taskId && (
              <button 
                className="px-8 py-4 bg-background text-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                onClick={() => setProgressData({ progress: 0, stage: '', error: null })}
              >
                {progressData.error ? 'Try Again' : 'Convert Another'}
              </button>
            )}
          </div>
        ) : (
          <button 
            className="mt-4 px-8 py-4 bg-accent text-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-brutal"
            disabled={!file}
            onClick={startConversion}
          >
            Start Conversion
          </button>
        )}
      </div>
    </div>
  );
}
