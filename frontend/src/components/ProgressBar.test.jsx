import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from './ProgressBar';

describe('ProgressBar', () => {
  it('renders percentage badge and stage subtitle cleanly', () => {
    render(<ProgressBar progress={45} stage="Extracting frame 150..." />);

    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Extracting frame 150...')).toBeInTheDocument();
  });

  it('renders complex stage messages without truncation clipping', () => {
    const stageMessage = 'Dithering frame 320/595 (rgb565)...';
    render(<ProgressBar progress={70} stage={stageMessage} />);

    expect(screen.getByText(stageMessage)).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('displays fallback stage when stage prop is not provided', () => {
    render(<ProgressBar progress={0} />);

    expect(screen.getByText('Initializing...')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders error state when error prop is provided', () => {
    const errorMsg = 'Failed to process video: format unsupported';
    render(<ProgressBar progress={25} stage="Encoding..." error={errorMsg} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it('applies smooth ease-out transition class and progress bar attributes', () => {
    render(<ProgressBar progress={60} stage="Processing..." />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveClass('transition-all');
    expect(bar).toHaveClass('duration-300');
    expect(bar).toHaveClass('ease-out');
    expect(bar).toHaveStyle({ width: '60%' });
  });
});
