import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';

describe('App', () => {
  it('renders Topbar, Sidebar, and default Home View', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(screen.getAllByText('SoulCast IV')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /converter/i })).toBeInTheDocument();
    expect(screen.getByText('Welcome to SoulCast IV')).toBeInTheDocument();
  });

  it('switches view when Sidebar buttons or CTA are clicked', async () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(screen.getByText('Welcome to SoulCast IV')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /converter/i }));
    await waitFor(() => {
      expect(screen.getByText('Drag & Drop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    await waitFor(() => {
      expect(screen.getByText('Welcome to SoulCast IV')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /start converting/i }));
    await waitFor(() => {
      expect(screen.getByText('Drag & Drop')).toBeInTheDocument();
    });
  });
});
