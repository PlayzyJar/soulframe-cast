import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Topbar from './Topbar';
import { ThemeProvider } from '../ThemeProvider';

describe('Topbar', () => {
  it('renders the application title', () => {
    render(
      <ThemeProvider>
        <Topbar />
      </ThemeProvider>
    );

    expect(screen.getAllByText('SoulCast IV')[0]).toBeInTheDocument();
  });

  it('toggles theme when button is clicked', () => {
    render(
      <ThemeProvider>
        <Topbar />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();

    // Default theme is light, documentElement has light class
    expect(document.documentElement.classList.contains('light')).toBe(true);

    fireEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(button);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
