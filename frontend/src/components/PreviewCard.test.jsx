import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PreviewCard from './PreviewCard';

describe('PreviewCard', () => {
  const dummyFile = new File(['dummy content'], 'animation.mp4', { type: 'video/mp4' });
  const defaultSettings = {
    resolution: '128x64',
    fps: 15,
    dithering: 'floyd-steinberg',
    color_mode: 'monochrome',
  };

  it('renders preview card with file present, shows "Preview Frame" button, timeline slider, and initial placeholder', () => {
    render(
      <PreviewCard
        file={dummyFile}
        settings={defaultSettings}
        previewData={null}
        isLoading={false}
        error={null}
        timestamp={0.0}
        onTimestampChange={vi.fn()}
        onGeneratePreview={vi.fn()}
      />
    );

    // Title
    expect(screen.getByText(/live display simulation/i)).toBeInTheDocument();

    // "Preview Frame" button
    const previewBtn = screen.getByRole('button', { name: /preview frame/i });
    expect(previewBtn).toBeInTheDocument();
    expect(previewBtn).not.toBeDisabled();

    // Timeline slider
    const timelineSlider = screen.getByLabelText(/timeline \(seconds\): 0\.0s/i);
    expect(timelineSlider).toBeInTheDocument();
    expect(timelineSlider).toHaveAttribute('type', 'range');

    // Initial placeholder
    expect(
      screen.getByText(/click 'preview frame' to render simulated display/i)
    ).toBeInTheDocument();
  });

  it('triggers onGeneratePreview when "Preview Frame" button is clicked', () => {
    const onGeneratePreview = vi.fn();
    render(
      <PreviewCard
        file={dummyFile}
        settings={defaultSettings}
        previewData={null}
        isLoading={false}
        error={null}
        timestamp={2.5}
        onTimestampChange={vi.fn()}
        onGeneratePreview={onGeneratePreview}
      />
    );

    const previewBtn = screen.getByRole('button', { name: /preview frame/i });
    fireEvent.click(previewBtn);

    expect(onGeneratePreview).toHaveBeenCalledTimes(1);
  });

  it('renders simulated display image with pixelated rendering when previewData is provided', () => {
    const previewData = {
      preview_image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      resolution: '128x64',
      color_mode: 'monochrome',
      bytes_per_frame: 1024,
      formatted_frame_size: '1.0 KB',
      timestamp_sec: 1.5,
    };

    render(
      <PreviewCard
        file={dummyFile}
        settings={defaultSettings}
        previewData={previewData}
        isLoading={false}
        error={null}
        timestamp={1.5}
        onTimestampChange={vi.fn()}
        onGeneratePreview={vi.fn()}
      />
    );

    const img = screen.getByRole('img', { name: /simulated micro-display/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', previewData.preview_image);
    expect(img.style.imageRendering).toBe('pixelated');
  });

  it('renders hardware telemetry (Resolution, Color Mode, Frame Size)', () => {
    const previewData = {
      preview_image: 'data:image/png;base64,dummy',
      resolution: '240x240',
      color_mode: 'rgb565',
      bytes_per_frame: 115200,
      formatted_frame_size: '112.5 KB',
      timestamp_sec: 0.0,
    };

    const rgbSettings = {
      resolution: '240x240',
      fps: 30,
      dithering: 'none',
      color_mode: 'rgb565',
    };

    render(
      <PreviewCard
        file={dummyFile}
        settings={rgbSettings}
        previewData={previewData}
        isLoading={false}
        error={null}
        timestamp={0.0}
        onTimestampChange={vi.fn()}
        onGeneratePreview={vi.fn()}
      />
    );

    // Resolution telemetry
    expect(screen.getByText(/240x240/i)).toBeInTheDocument();

    // Color Mode telemetry
    expect(screen.getByText(/rgb565 \(16-bit\)/i)).toBeInTheDocument();

    // Frame Size telemetry
    expect(screen.getByText(/112\.5 KB \/ frame/i)).toBeInTheDocument();

    // High Flash memory warning badge for > 100000 bytes/frame
    expect(
      screen.getByText(/high flash memory/i)
    ).toBeInTheDocument();
  });

  it('triggers onTimestampChange when timeline range input is adjusted', () => {
    const onTimestampChange = vi.fn();
    render(
      <PreviewCard
        file={dummyFile}
        settings={defaultSettings}
        previewData={null}
        isLoading={false}
        error={null}
        timestamp={0.0}
        onTimestampChange={onTimestampChange}
        onGeneratePreview={vi.fn()}
      />
    );

    const slider = screen.getByLabelText(/timeline \(seconds\): 0\.0s/i);
    fireEvent.change(slider, { target: { value: '12.5' } });

    expect(onTimestampChange).toHaveBeenCalledWith(12.5);
  });

  it('shows animated loading state when isLoading is true', () => {
    render(
      <PreviewCard
        file={dummyFile}
        settings={defaultSettings}
        previewData={null}
        isLoading={true}
        error={null}
        timestamp={0.0}
        onTimestampChange={vi.fn()}
        onGeneratePreview={vi.fn()}
      />
    );

    expect(screen.getByText(/rendering frame\.\.\./i)).toBeInTheDocument();
    const previewBtn = screen.getByRole('button', { name: /preview frame/i });
    expect(previewBtn).toBeDisabled();
  });

  it('shows error message when error is provided', () => {
    render(
      <PreviewCard
        file={dummyFile}
        settings={defaultSettings}
        previewData={null}
        isLoading={false}
        error="Failed to decode video frame"
        timestamp={0.0}
        onTimestampChange={vi.fn()}
        onGeneratePreview={vi.fn()}
      />
    );

    expect(screen.getByText(/failed to decode video frame/i)).toBeInTheDocument();
  });
});
