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
  const [progressData, setProgressData] = useState({ progress: 0, stage: '', error: null, status: 'idle' });

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
  };

  const startConversion = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setProgressData({ progress: 0, stage: 'Starting...', error: null, status: 'processing' });

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
      setProgressData(prev => ({ ...prev, error: err.message, stage: 'Failed to start', status: 'failed' }));
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
        error: data.error,
        status: data.status
      });

      if (data.status === 'completed' || data.status === 'failed') {
        eventSource.close();
        setIsProcessing(false);
        setTaskId(null);
      }
    };

    eventSource.onerror = (err) => {
      setProgressData(prev => ({ ...prev, error: 'SSE Connection lost', stage: 'Error', status: 'failed' }));
      eventSource.close();
      setIsProcessing(false);
      setTaskId(null);
    };

    return () => {
      eventSource.close();
    };
  }, [taskId]);

  if (progressData.status === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto py-12 px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter mb-4 text-primary">Conversion Complete!</h2>
        <p className="text-xl mb-12 font-mono bg-accent/20 p-4 border-4 border-foreground shadow-brutal inline-block">
          Your video has been successfully converted.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6 mb-12">
          <button 
            onClick={() => alert("Downloading ZIP...")}
            className="px-8 py-5 bg-primary text-primary-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download ZIP
          </button>
          
          <button 
            onClick={() => alert("Downloading C++ Header...")}
            className="px-8 py-5 bg-accent text-accent-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Download C++ Header
          </button>
        </div>
        
        <button 
          onClick={() => {
            setFile(null);
            setProgressData({ progress: 0, stage: '', error: null, status: 'idle' });
          }}
          className="px-6 py-3 bg-background text-foreground text-lg font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all mt-auto"
        >
          Start Over
        </button>
      </div>
    );
  }

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
                onClick={() => setProgressData({ progress: 0, stage: '', error: null, status: 'idle' })}
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
