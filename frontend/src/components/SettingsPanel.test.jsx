import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';

describe('SettingsPanel', () => {
  const defaultSettings = {
    resolution: '128x64',
    fps: 15,
    dithering: 'floyd-steinberg',
    color_mode: 'monochrome',
  };

  it('renders Color Mode dropdown and verifies selecting a new mode triggers onSettingsChange', () => {
    const onSettingsChange = vi.fn();
    render(<SettingsPanel settings={defaultSettings} onSettingsChange={onSettingsChange} />);

    const colorModeSelect = screen.getByLabelText(/color mode/i);
    expect(colorModeSelect).toBeInTheDocument();
    expect(colorModeSelect).toHaveValue('monochrome');

    fireEvent.change(colorModeSelect, { target: { name: 'color_mode', value: 'rgb565' } });

    expect(onSettingsChange).toHaveBeenCalledWith({
      ...defaultSettings,
      color_mode: 'rgb565',
    });
  });

  it('disables dithering dropdown and shows helper note when color_mode is rgb565', () => {
    const rgbSettings = {
      ...defaultSettings,
      color_mode: 'rgb565',
    };
    render(<SettingsPanel settings={rgbSettings} onSettingsChange={vi.fn()} />);

    const ditheringSelect = screen.getByLabelText(/dithering algorithm/i);
    expect(ditheringSelect).toBeDisabled();

    expect(
      screen.getByText(/dithering applies to monochrome 1-bit only/i)
    ).toBeInTheDocument();
  });

  it('disables dithering dropdown and shows helper note when color_mode is grayscale', () => {
    const grayscaleSettings = {
      ...defaultSettings,
      color_mode: 'grayscale',
    };
    render(<SettingsPanel settings={grayscaleSettings} onSettingsChange={vi.fn()} />);

    const ditheringSelect = screen.getByLabelText(/dithering algorithm/i);
    expect(ditheringSelect).toBeDisabled();

    expect(
      screen.getByText(/dithering applies to monochrome 1-bit only/i)
    ).toBeInTheDocument();
  });

  it('enables dithering dropdown when color_mode is monochrome', () => {
    render(<SettingsPanel settings={defaultSettings} onSettingsChange={vi.fn()} />);

    const ditheringSelect = screen.getByLabelText(/dithering algorithm/i);
    expect(ditheringSelect).not.toBeDisabled();
    expect(
      screen.queryByText(/dithering applies to monochrome 1-bit only/i)
    ).not.toBeInTheDocument();
  });

  it('defaults color_mode to monochrome when not provided in settings', () => {
    const settingsWithoutColor = {
      resolution: '128x64',
      fps: 15,
      dithering: 'floyd-steinberg',
    };
    render(<SettingsPanel settings={settingsWithoutColor} onSettingsChange={vi.fn()} />);

    const colorModeSelect = screen.getByLabelText(/color mode/i);
    expect(colorModeSelect).toHaveValue('monochrome');
    const ditheringSelect = screen.getByLabelText(/dithering algorithm/i);
    expect(ditheringSelect).not.toBeDisabled();
  });
});
