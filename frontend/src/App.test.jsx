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

    expect(screen.getByText('SoulCast IV')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /converter/i })).toBeInTheDocument();
    expect(screen.getByText('Home View Placeholder')).toBeInTheDocument();
  });

  it('switches view when Sidebar buttons are clicked', async () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(screen.getByText('Home View Placeholder')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /converter/i }));
    await waitFor(() => {
      expect(screen.getByText('Converter View Placeholder')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    await waitFor(() => {
      expect(screen.getByText('Home View Placeholder')).toBeInTheDocument();
    });
  });
});
