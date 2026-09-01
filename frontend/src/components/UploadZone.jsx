import React, { useRef, useState } from 'react';

export default function UploadZone({ onFileSelect }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`flex flex-col items-center justify-center p-8 border-4 border-dashed border-foreground cursor-pointer transition-all ${isDragging ? 'bg-accent/20 scale-[1.02]' : 'bg-background hover:bg-accent/10'} shadow-brutal w-full`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{ minHeight: '400px' }}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="video/*,image/gif"
      />
      <div className="text-6xl mb-6">📁</div>
      <h3 className="text-3xl font-extrabold uppercase mb-2">Drag & Drop</h3>
      <p className="text-lg text-muted-foreground uppercase font-bold">or click to select a video/GIF</p>
    </div>
  );
}
