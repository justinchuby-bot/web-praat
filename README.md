# Web Praat

A browser-based speech analysis workstation inspired by [Praat](https://www.fon.hum.uva.nl/praat/), built with React, strict TypeScript, and custom DSP only.

![Stack](https://img.shields.io/badge/React_19-TypeScript-blue)
[![CI](https://github.com/justinchuby/web-praat/actions/workflows/ci.yml/badge.svg)](https://github.com/justinchuby/web-praat/actions/workflows/ci.yml)

<img width="2354" height="1212" alt="image" src="https://github.com/user-attachments/assets/14fa2de8-3f54-44ec-8b70-86c80b718e4b" />


## Features

- Recording, playback, drag-and-drop audio loading
- Waveform display with time selection
- Spectrogram with configurable FFT size, hop size, dynamic range, and colormap
- Pitch tracking with configurable min/max frequency and voicing threshold
- LPC-based formant extraction plus continuous formant trajectory tracking
- Intensity contour overlay
- Spectrum slice analysis from spectrogram clicks with FFT magnitude and LPC envelope
- TextGrid annotation editor with interval tiers, point tiers, boundary insertion, label editing, drag repositioning, and Praat `.TextGrid` import/export
- Zoom and navigation with mouse-wheel zoom, shift/middle-button pan, ctrl-drag zoom-to-region, fit-to-window, and a time ruler
- Voice-quality analysis with pulse detection, jitter metrics, and shimmer metrics
- Biquad filters from scratch: low-pass, high-pass, and band-pass
- Audio editing with cut, copy, paste, delete, undo, and redo
- Data export for TextGrid, pitch/formant/intensity CSV, and selected-region WAV
- Duration and rhythm statistics including mean, stdev, min, max, nPVI, and rPVI

## DSP Implementation

All signal processing is implemented locally without third-party DSP libraries.

- FFT: radix-2 Cooley-Tukey
- Spectrogram: STFT with Hamming window
- Pitch: normalized autocorrelation
- Formants: Burg LPC + root analysis + dynamic programming tracking
- Spectrum slice: frame FFT + LPC spectral envelope
- Voice quality: differentiated-waveform pulse picking with jitter/shimmer formulas
- Filters: RBJ-style biquad IIR design and sample-by-sample filtering
- WAV export: PCM16 encoding and manual RIFF/WAVE header writing

## Getting Started

```bash
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

## Project Structure

```text
src/
  App.tsx
  audio/
    analyzer.ts
    defaults.ts
    editor.ts
    filters.ts
    formantTracking.ts
    lpc.ts
    recorder.ts
    rhythm.ts
    spectrum.ts
    voiceQuality.ts
  components/
    Controls.tsx
    FilterPanel.tsx
    RhythmPanel.tsx
    SettingsPanel.tsx
    Sidebar.tsx
    Spectrogram.tsx
    SpectrumSlice.tsx
    TextGridEditor.tsx
    TimeRuler.tsx
    VoiceQualityPanel.tsx
    Waveform.tsx
  export/
    index.ts
  textgrid/
    parser.ts
  utils/
    colormap.ts
    fft.ts
    id.ts
    view.ts
tests/
  analyzer.test.ts
  editor.test.ts
  export.test.ts
  filters.test.ts
  formantTracking.test.ts
  lpc.test.ts
  rhythm.test.ts
  textgrid.test.ts
  voiceQuality.test.ts
  zoom.test.ts
```

## Development Notes

- TypeScript `strict` mode is enabled.
- The app state drives re-analysis when settings change.
- Tests cover parser/export behavior, zoom math, formant tracking, voice quality, filters, rhythm metrics, and editor history.
