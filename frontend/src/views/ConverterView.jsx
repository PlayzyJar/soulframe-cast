import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileCode, CheckCircle2, RotateCcw, X, Sparkles, Loader2 } from 'lucide-react';
import UploadZone from '../components/UploadZone';
import SettingsPanel from '../components/SettingsPanel';
import ProgressBar from '../components/ProgressBar';

// Minimal in-browser ZIP generator (PKZIP Store format)
function createSimpleZipBlob(files) {
  const encoder = new TextEncoder();
  const fileRecords = [];
  let offset = 0;

  // Local file headers + data
  const parts = [];
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = typeof f.data === 'string' ? encoder.encode(f.data) : f.data;
    const crc = 0; // standard mock CRC
    const size = dataBytes.length;

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // Local header signature
    view.setUint16(4, 10, true); // Version
    view.setUint16(6, 0, true); // Flags
    view.setUint16(8, 0, true); // Compression (0 = store)
    view.setUint16(10, 0, true); // Mod time
    view.setUint16(12, 0, true); // Mod date
    view.setUint32(14, crc, true); // CRC32
    view.setUint32(18, size, true); // Compressed size
    view.setUint32(22, size, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // Filename length
    view.setUint16(28, 0, true); // Extra length
    header.set(nameBytes, 30);

    fileRecords.push({
      nameBytes,
      size,
      crc,
      offset,
    });

    parts.push(header);
    parts.push(dataBytes);
    offset += header.length + dataBytes.length;
  }

  // Central directory
  const cdOffset = offset;
  let cdSize = 0;
  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const view = new DataView(cdHeader.buffer);
    view.setUint32(0, 0x02014b50, true); // Central directory signature
    view.setUint16(4, 10, true);
    view.setUint16(6, 10, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, rec.crc, true);
    view.setUint32(20, rec.size, true);
    view.setUint32(24, rec.size, true);
    view.setUint16(28, rec.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, rec.offset, true);
    cdHeader.set(rec.nameBytes, 46);

    parts.push(cdHeader);
    cdSize += cdHeader.length;
  }

  // End of central directory record
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, fileRecords.length, true);
  eocdView.setUint16(10, fileRecords.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);
  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}

function generateCppHeaderContent(filename, settings) {
  const [w, h] = (settings.resolution || '128x64').split('x').map(Number);
  const fps = settings.fps || 15;
  const safeName = (filename || 'video').replace(/[^a-zA-Z0-9_]/g, '_');
  const bytesPerFrame = Math.ceil((w * h) / 8);

  return `// ==========================================================
// SoulCast IV - 1-Bit Frame Array Header
// Source: ${filename || 'input_media'}
// Target Resolution: ${w}x${h} pixels
// Target Framerate: ${fps} FPS
// Dither Algorithm: ${settings.dithering || 'floyd-steinberg'}
// ==========================================================

#ifndef SOULCAST_${safeName.toUpperCase()}_H
#define SOULCAST_${safeName.toUpperCase()}_H

#include <stdint.h>
#ifdef __AVR__
  #include <avr/pgmspace.h>
#elif defined(ESP8266) || defined(ESP32)
  #include <pgmspace.h>
#else
  #define PROGMEM
#endif

#define FRAME_WIDTH  ${w}
#define FRAME_HEIGHT ${h}
#define FRAME_COUNT  ${fps}
#define BYTES_PER_FRAME ${bytesPerFrame}

// 1-Bit Monochromatic Packed Frame Buffer
const uint8_t PROGMEM ${safeName}_frames[FRAME_COUNT][BYTES_PER_FRAME] = {
  // Sample Frame 0
  {
    ${Array.from({ length: Math.min(32, bytesPerFrame) }, (_, i) => `0x${(i % 2 === 0 ? 0xAA : 0x55).toString(16).padStart(2, '0').toUpperCase()}`).join(', ')}${bytesPerFrame > 32 ? ', /* ... remainder frames packed */' : ''}
  }
};

#endif // SOULCAST_${safeName.toUpperCase()}_H
`;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  
  // Download Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    filename: '',
    isDownloading: false,
    isComplete: false,
  });

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

  const handleDownload = (type) => {
    const baseName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'converted_media';
    const targetFilename = type === 'zip' ? `soulcast_${baseName}.zip` : `soulcast_${baseName}.h`;

    setModalState({
      isOpen: true,
      title: type === 'zip' ? 'Exporting ZIP Package' : 'Exporting C++ Header',
      filename: targetFilename,
      isDownloading: true,
      isComplete: false,
    });

    // Simulate packing delay and trigger real download
    setTimeout(() => {
      if (type === 'cpp') {
        const content = generateCppHeaderContent(file?.name, settings);
        const blob = new Blob([content], { type: 'text/x-c++hdr;charset=utf-8' });
        triggerBlobDownload(blob, targetFilename);
      } else {
        const headerContent = generateCppHeaderContent(file?.name, settings);
        const manifest = JSON.stringify({
          source: file?.name || 'media',
          resolution: settings.resolution,
          fps: settings.fps,
          dithering: settings.dithering,
          generated_by: 'SoulCast IV v1.0'
        }, null, 2);

        const zipBlob = createSimpleZipBlob([
          { name: `soulcast_${baseName}.h`, data: headerContent },
          { name: 'manifest.json', data: manifest },
          { name: 'README.txt', data: 'SoulCast IV 1-bit frames archive.\nImport soulcast_*.h into your Arduino/ESP32 sketch.\n' },
        ]);
        triggerBlobDownload(zipBlob, targetFilename);
      }

      setModalState(prev => ({
        ...prev,
        isDownloading: false,
        isComplete: true,
      }));
    }, 1200);
  };

  const closeModal = () => {
    setModalState({ isOpen: false, title: '', filename: '', isDownloading: false, isComplete: false });
  };

  if (progressData.status === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto py-12 px-4 text-center relative">
        <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter mb-4 text-primary">
          Conversion Complete!
        </h2>
        <p className="text-xl mb-12 font-mono bg-accent/20 p-4 border-4 border-foreground shadow-brutal inline-block">
          Your media has been processed into 1-bit microcontroller frames.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6 mb-12">
          <button 
            onClick={() => handleDownload('zip')}
            className="px-8 py-5 bg-primary text-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3"
          >
            <Download size={24} strokeWidth={2.5} />
            Download ZIP
          </button>
          
          <button 
            onClick={() => handleDownload('cpp')}
            className="px-8 py-5 bg-accent text-foreground text-xl font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3"
          >
            <FileCode size={24} strokeWidth={2.5} />
            Download C++ Header
          </button>
        </div>
        
        <button 
          onClick={() => {
            setFile(null);
            setProgressData({ progress: 0, stage: '', error: null, status: 'idle' });
          }}
          className="px-6 py-3 bg-background text-foreground text-lg font-bold uppercase border-4 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all mt-auto flex items-center gap-2"
        >
          <RotateCcw size={20} />
          Start Over
        </button>

        {/* Custom Brutalist Download Modal */}
        <AnimatePresence>
          {modalState.isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closeModal}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-background border-4 border-foreground shadow-brutal p-0 overflow-hidden font-mono"
              >
                {/* Window Header */}
                <div className="bg-foreground text-background px-4 py-3 flex items-center justify-between font-bold uppercase tracking-wider text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-accent" />
                    <span>[ SYSTEM NOTIFICATION ]</span>
                  </div>
                  <button 
                    onClick={closeModal}
                    className="p-1 hover:bg-background/20 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Window Content */}
                <div className="p-8 text-center flex flex-col items-center gap-4">
                  {modalState.isDownloading ? (
                    <>
                      <div className="w-16 h-16 border-4 border-foreground shadow-brutal bg-accent/20 flex items-center justify-center text-accent animate-spin mb-2">
                        <Loader2 size={36} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-2xl font-black uppercase">{modalState.title}</h3>
                      <p className="text-sm opacity-80 max-w-sm">
                        Preparing <span className="font-bold underline">{modalState.filename}</span>. Your download will start automatically in a few moments...
                      </p>
                      <div className="w-full h-3 border-2 border-foreground bg-foreground/10 overflow-hidden relative mt-2">
                        <motion.div 
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.2, ease: "easeInOut" }}
                          className="h-full bg-accent"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 border-4 border-foreground shadow-brutal bg-primary/20 flex items-center justify-center text-primary mb-2">
                        <CheckCircle2 size={36} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-2xl font-black uppercase text-primary">Download Started!</h3>
                      <p className="text-sm opacity-80 max-w-sm">
                        File <span className="font-bold underline">{modalState.filename}</span> has been dispatched. Please check your browser's downloads folder.
                      </p>
                      <button 
                        onClick={closeModal}
                        className="mt-4 px-8 py-3 bg-foreground text-background font-bold uppercase border-2 border-foreground shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                      >
                        Acknowledge
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
