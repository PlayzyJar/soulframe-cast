import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomeView from './HomeView';

describe('HomeView', () => {
  it('renders title, description and Start Converting button', () => {
    const setView = vi.fn();
    render(<HomeView setView={setView} />);

    expect(screen.getByText('Welcome to SoulCast IV')).toBeInTheDocument();
    expect(
      screen.getByText(/Convert your videos and GIFs into 1-bit frames/i)
    ).toBeInTheDocument();
    
    const startBtn = screen.getByRole('button', { name: /start converting/i });
    expect(startBtn).toBeInTheDocument();
  });

  it('calls setView("converter") when Start Converting button is clicked', () => {
    const setView = vi.fn();
    render(<HomeView setView={setView} />);

    const startBtn = screen.getByRole('button', { name: /start converting/i });
    fireEvent.click(startBtn);

    expect(setView).toHaveBeenCalledWith('converter');
  });
});
