import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConverterView from './ConverterView';

describe('ConverterView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render PreviewCard when no file is selected', () => {
    render(<ConverterView />);

    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    expect(screen.queryByText(/live display simulation/i)).not.toBeInTheDocument();
  });

  it('renders PreviewCard and requests preview when a file is selected', async () => {
    const mockPreviewResponse = {
      preview_image: 'data:image/png;base64,samplebase64',
      resolution: '128x64',
      color_mode: 'monochrome',
      bytes_per_frame: 1024,
      formatted_frame_size: '1.0 KB',
      timestamp_sec: 0.0,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPreviewResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConverterView />);

    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['test video content'], 'test_video.mp4', { type: 'video/mp4' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // File selected display appears
    expect(screen.getByText('test_video.mp4')).toBeInTheDocument();

    // PreviewCard is now rendered
    expect(screen.getByText(/live display simulation/i)).toBeInTheDocument();

    // Verify fetch was called with /preview
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/preview'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    // Verify the preview image is rendered after fetch response
    await waitFor(() => {
      const img = screen.getByRole('img', { name: /simulated micro-display/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', mockPreviewResponse.preview_image);
    });
  });

  it('re-fetches preview when settings are changed while preview is active', async () => {
    const mockPreviewResponse1 = {
      preview_image: 'data:image/png;base64,monochromeFrame',
      resolution: '128x64',
      color_mode: 'monochrome',
      bytes_per_frame: 1024,
      formatted_frame_size: '1.0 KB',
      timestamp_sec: 0.0,
    };

    const mockPreviewResponse2 = {
      preview_image: 'data:image/png;base64,rgbFrame',
      resolution: '128x64',
      color_mode: 'rgb565',
      bytes_per_frame: 16384,
      formatted_frame_size: '16.0 KB',
      timestamp_sec: 0.0,
    };

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => (callCount === 1 ? mockPreviewResponse1 : mockPreviewResponse2),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConverterView />);

    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['video bytes'], 'clip.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /simulated micro-display/i })).toBeInTheDocument();
    });

    // Change color mode in settings
    const colorModeSelect = screen.getByLabelText(/color mode/i);
    fireEvent.change(colorModeSelect, { target: { name: 'color_mode', value: 'rgb565' } });

    // Verify preview was re-fetched
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('triggers preview fetch when "Preview Frame" button is clicked at scrubbed timestamp', async () => {
    const mockPreviewResponse = {
      preview_image: 'data:image/png;base64,frameAt10s',
      resolution: '128x64',
      color_mode: 'monochrome',
      bytes_per_frame: 1024,
      formatted_frame_size: '1.0 KB',
      timestamp_sec: 10.0,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPreviewResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ConverterView />);

    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['clip'], 'clip.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Scrub timeline to 10s
    const slider = screen.getByLabelText(/timeline \(seconds\)/i);
    fireEvent.change(slider, { target: { value: '10' } });

    // Click "Preview Frame"
    const previewBtn = screen.getByRole('button', { name: /preview frame/i });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
