import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('renders navigation buttons for Home and Converter', () => {
    const setView = vi.fn();
    render(<Sidebar setView={setView} />);

    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /converter/i })).toBeInTheDocument();
  });

  it('calls setView with "home" when Home button is clicked', () => {
    const setView = vi.fn();
    render(<Sidebar setView={setView} />);

    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    expect(setView).toHaveBeenCalledWith('home');
  });

  it('calls setView with "converter" when Converter button is clicked', () => {
    const setView = vi.fn();
    render(<Sidebar setView={setView} />);

    fireEvent.click(screen.getByRole('button', { name: /converter/i }));
    expect(setView).toHaveBeenCalledWith('converter');
  });
});
