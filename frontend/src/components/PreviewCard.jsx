import React from 'react';
import { Loader2, Monitor, AlertTriangle, Cpu, HardDrive } from 'lucide-react';

export default function PreviewCard({
  file,
  settings,
  previewData,
  isLoading = false,
  error = null,
  timestamp = 0.0,
  onTimestampChange,
  onGeneratePreview,
}) {
  const currentTimestamp = Number(timestamp) || 0.0;

  // Resolve telemetry values
  const resolution = previewData?.resolution || settings?.resolution || '128x64';
  const [w, h] = resolution.split('x').map(Number);
  const colorMode = previewData?.color_mode || settings?.color_mode || 'monochrome';

  let bytesPerFrame = previewData?.bytes_per_frame;
  let formattedFrameSize = previewData?.formatted_frame_size;

  if (bytesPerFrame == null) {
    const mode = String(colorMode).toLowerCase();
    if (mode === 'rgb565') {
      bytesPerFrame = (w || 128) * (h || 64) * 2;
    } else if (mode === 'grayscale') {
      bytesPerFrame = (w || 128) * (h || 64);
    } else {
      bytesPerFrame = Math.ceil((w || 128) / 8) * (h || 64);
    }
  }

  if (!formattedFrameSize) {
    if (bytesPerFrame < 1024) {
      formattedFrameSize = `${bytesPerFrame} B`;
    } else if (bytesPerFrame < 1024 * 1024) {
      formattedFrameSize = `${(bytesPerFrame / 1024).toFixed(1)} KB`;
    } else {
      formattedFrameSize = `${(bytesPerFrame / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  const formatColorModeLabel = (mode) => {
    const m = String(mode || '').toLowerCase();
    if (m === 'rgb565') return 'RGB565 (16-bit)';
    if (m === 'grayscale') return 'Grayscale (8-bit)';
    return 'Monochrome (1-bit)';
  };

  const isHighFlash = bytesPerFrame > 100000;

  return (
    <div className="flex flex-col gap-5 p-6 border-4 border-foreground shadow-brutal bg-background font-mono w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-foreground/20 pb-3">
        <div className="flex items-center gap-2">
          <Monitor size={22} className="text-accent" />
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
            Live Display Simulation
          </h3>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase bg-accent text-foreground border-2 border-foreground shadow-brutal flex items-center gap-1.5 animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              RENDERING
            </span>
          ) : error ? (
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase bg-red-500 text-white border-2 border-foreground shadow-brutal">
              ERROR
            </span>
          ) : previewData?.preview_image ? (
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase bg-green-500 text-foreground border-2 border-foreground shadow-brutal">
              ACTIVE
            </span>
          ) : (
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase bg-foreground/10 text-foreground border-2 border-foreground shadow-brutal">
              STANDBY
            </span>
          )}
        </div>
      </div>

      {/* Micro-Display Simulation Frame */}
      <div className="relative bg-black border-4 border-foreground shadow-brutal p-4 flex items-center justify-center min-h-[220px] overflow-hidden">
        {/* Subtle CRT screen scanlines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-15 z-10"
          style={{
            backgroundImage: 'linear-gradient(transparent 50%, rgba(0, 0, 0, 0.5) 50%)',
            backgroundSize: '100% 4px',
          }}
        />

        {/* Display Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-accent z-20 py-8">
            <Loader2 size={36} className="animate-spin" />
            <span className="text-sm font-bold uppercase tracking-wider animate-pulse">
              Rendering Frame...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 text-red-400 p-4 text-center z-20 max-w-md">
            <AlertTriangle size={32} className="text-red-500" />
            <span className="font-bold uppercase text-xs sm:text-sm tracking-wide break-words">
              {error}
            </span>
          </div>
        ) : previewData?.preview_image ? (
          <div className="relative z-20 flex items-center justify-center max-h-72 w-full p-2">
            <img
              src={previewData.preview_image}
              alt="Simulated Micro-Display Frame"
              style={{ imageRendering: 'pixelated' }}
              className="max-h-64 max-w-full object-contain border-2 border-white/20 shadow-lg"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-400 p-6 text-center z-20">
            <Monitor size={36} className="mb-2 opacity-50" />
            <p className="font-bold uppercase text-xs sm:text-sm max-w-xs">
              Click 'Preview Frame' to render simulated display
            </p>
          </div>
        )}
      </div>

      {/* Timeline Controls */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex justify-between items-center">
          <label htmlFor="preview-timeline" className="font-bold uppercase text-xs sm:text-sm">
            Timeline (Seconds): {currentTimestamp.toFixed(1)}s
          </label>
        </div>

        <input
          type="range"
          id="preview-timeline"
          min="0"
          max="60"
          step="0.5"
          value={currentTimestamp}
          onChange={(e) => onTimestampChange && onTimestampChange(parseFloat(e.target.value))}
          className="w-full accent-accent cursor-pointer h-2 border-2 border-foreground bg-background"
        />

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onGeneratePreview}
            disabled={isLoading || !file}
            className="w-full sm:w-auto px-6 py-3 border-4 border-foreground bg-accent hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal font-bold uppercase text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:shadow-brutal flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            Preview Frame
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Bar */}
      <div className="flex flex-col gap-2 pt-2 border-t-2 border-foreground/20">
        <div className="text-xs uppercase font-bold text-foreground/70 tracking-wider flex items-center gap-1.5">
          <Cpu size={14} />
          <span>Hardware Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Resolution */}
          <div className="p-3 border-2 border-foreground bg-foreground/5 flex flex-col">
            <span className="text-[10px] uppercase font-bold text-foreground/60 mb-0.5">
              Resolution
            </span>
            <span className="text-sm font-extrabold uppercase">
              {resolution} px
            </span>
          </div>

          {/* Color Mode */}
          <div className="p-3 border-2 border-foreground bg-foreground/5 flex flex-col">
            <span className="text-[10px] uppercase font-bold text-foreground/60 mb-0.5">
              Color Mode
            </span>
            <span className="text-sm font-extrabold uppercase">
              {formatColorModeLabel(colorMode)}
            </span>
          </div>

          {/* Frame Size */}
          <div className="p-3 border-2 border-foreground bg-foreground/5 flex flex-col">
            <span className="text-[10px] uppercase font-bold text-foreground/60 mb-0.5">
              Frame Size
            </span>
            <span className="text-sm font-extrabold uppercase">
              {formattedFrameSize} / frame
            </span>
          </div>
        </div>

        {/* Flash Estimation / Warning */}
        {isHighFlash && (
          <div className="mt-2 p-3 border-2 border-foreground bg-accent/20 flex items-start gap-2.5 text-xs uppercase font-bold">
            <HardDrive size={18} className="flex-shrink-0 text-accent mt-0.5" />
            <span>
              High Flash Memory (~{formattedFrameSize}/frame). Recommended for ESP32 / SD cards or short clips.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
