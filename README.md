# Web Praat

A web-based speech analysis tool inspired by [Praat](https://www.fon.hum.uva.nl/praat/), built entirely in the browser with no external DSP libraries.

![Stack](https://img.shields.io/badge/React_18-TypeScript-blue)
![Build](https://img.shields.io/badge/Vite-5-purple)
![Tests](https://img.shields.io/badge/tests-7_passing-green)

## Features

- **Record / Load Audio** — Record from microphone or drag-and-drop WAV/MP3/OGG files
- **Waveform Display** — Time-domain waveform with selection support
- **Spectrogram** — STFT spectrogram with jet colormap (1024 FFT, 256 hop, Hamming window)
- **Pitch (F0) Tracking** — Autocorrelation-based pitch detection (75–600 Hz), displayed as blue overlay
- **Formant Analysis** — Burg's LPC method with Durand-Kerner root finding (F1/F2/F3), displayed as red dots
- **Intensity Curve** — RMS-based loudness in dB, displayed as green overlay
- **Playback** — Play/pause with real-time cursor tracking
- **Time Selection** — Click and drag to select time ranges

## Tech Stack

- **React 18** + TypeScript (strict mode)
- **Vite** for development and building
- **Canvas API** for all visualizations
- **Web Audio API** for recording and playback
- **Vitest** for testing

## Algorithms (all from scratch)

| Feature | Method |
|---------|--------|
| Spectrogram | STFT with Hamming window, 1024-point FFT, 256-sample hop |
| Pitch | Normalized autocorrelation with voicing threshold |
| Formants | Burg's method (LPC order 12) → Durand-Kerner polynomial roots → formant selection |
| Intensity | Frame-wise RMS → dB conversion |
| FFT | Radix-2 Cooley-Tukey (in-place, bit-reversal) |

## Getting Started

```bash
npm install
npm run dev      # Start dev server
npm test         # Run tests
npm run build    # Production build
```

## Project Structure

```
src/
  App.tsx                 — Main application component
  components/
    Waveform.tsx          — Waveform canvas with selection
    Spectrogram.tsx       — Spectrogram + pitch/formant/intensity overlays
    Controls.tsx          — Record/play/file controls
    Sidebar.tsx           — Overlay toggles and settings
  audio/
    analyzer.ts           — STFT, pitch, formant, intensity analysis
    lpc.ts                — Burg's method LPC + Durand-Kerner root finding
    recorder.ts           — Web Audio recording + file loading
  utils/
    fft.ts                — Radix-2 FFT implementation
    colormap.ts           — Jet and grayscale colormaps
  types.ts                — TypeScript interfaces
tests/
  analyzer.test.ts        — FFT, pitch, intensity, spectrogram tests
  lpc.test.ts             — Burg's method and formant extraction tests
```

## Design

Modern dark theme (Catppuccin Mocha-inspired). Upper panel shows waveform, lower panel shows spectrogram with optional pitch/formant/intensity overlays. Sidebar provides overlay toggles.

## License

MIT
