# Web Praat

A browser-based port of [Praat](https://www.fon.hum.uva.nl/praat/) for phonetics research, teaching, and interactive exploration. Zero installation — runs entirely in the browser.

[![CI](https://github.com/justinchuby/web-praat/actions/workflows/ci.yml/badge.svg)](https://github.com/justinchuby/web-praat/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Tests](https://img.shields.io/badge/tests-529_passing-green)
![Coverage](https://img.shields.io/badge/coverage-74%25-yellow)

<img width="2354" height="1212" alt="image" src="https://github.com/user-attachments/assets/14fa2de8-3f54-44ec-8b70-86c80b718e4b" />

**[Live Demo →](https://justinchuby.github.io/web-praat/)**

## Why web-praat?

- **Zero install** — open a browser, start analyzing
- **Interactive** — real-time parameter sliders, vowel space visualization, live recording with spectrogram
- **Teaching-focused** — students can see how LPC order / pitch range / voicing threshold affect results instantly
- **Mobile-friendly** — works on phones and tablets with touch gestures
- **Private** — audio never leaves your browser

For production research pipelines, use [Praat](https://www.praat.org/) or [Parselmouth](https://parselmouth.readthedocs.io/).

## Features

### Acoustic Analysis
- Wideband/narrowband spectrogram (6 window functions, 8 colormaps, WebGPU-accelerated FFT)
- Pitch (F0) — normalized autocorrelation + Viterbi path tracking
- Formants — Burg LPC, adjustable order 6–24
- Intensity (dB SPL), Harmonicity (HNR), Voice Quality (jitter/shimmer)
- MFCC, LTAS, Cochleagram, Excitation Pattern, Spectrum Slice
- Point Process, Rhythm Metrics (PVI, %V, ΔC)

### Annotation
- Full TextGrid editor (IntervalTier + TextTier)
- Praat long + short format import/export, ELAN (.eaf) import
- Boundary manipulation, keyboard navigation, controlled vocabulary

### Visualization
- Pitch contour, formant tracks (F1–F3), intensity curve overlays
- IPA vowel annotation tier
- Vowel Space panel (F1×F2 scatter + trajectory, Male/Female/Child)
- Publication-quality PNG figure export (2400×1200)
- 4 themes (Catppuccin Mocha/Latte/Frappe/Macchiato)

### Script Editor
- Multi-tab CodeMirror 6 editor (Praat Script + JavaScript)
- Praat Script interpreter (procedures, loops, string operations)
- JavaScript API (`praat.toPitch`, `praat.toFormant`, etc.)
- Batch processing — run scripts on multiple audio files, export CSV

### Tools
- Manipulation Editor (PSOLA), Pitch/Formant/Duration/Amplitude Tier editors
- Vocal Tract Editor, Spectrum Editor
- Noise reduction (Web Worker), Normalize, Reverse, Remove Silence
- All effects undoable (⌘Z), Biquad/Butterworth filtering
- Perception experiments (MFC), Speech Synthesizer, Pitch Sonification
- Plugin system (5 built-in), Command Palette (⌘⇧P)

### Recording & Playback
- Live recording with real-time spectrogram (AudioWorklet + fallback)
- iOS/Safari compatible
- Selection loop playback
- Long audio (>5 min) waveform-only mode with on-demand region analysis

## Accuracy

Validated against Praat 6.4 via [Parselmouth](https://parselmouth.readthedocs.io/) (same LPC order):

| Measurement | vs Praat |
|---|---|
| Pitch (F0) | ±5 Hz |
| Formants (F1) | ±50 Hz |
| Formants (F2) | ±50 Hz (well-separated); varies for close F2/F3 |
| Intensity (relative) | ±2 dB |

See [`docs/METHODS.md`](docs/METHODS.md) for algorithm citations and [`tests/validation/`](tests/validation/) for the full cross-validation suite.

## Getting Started

```bash
npm install
npm run dev     # dev server at localhost:5173
npm test        # 529 tests
npm run build   # production build
```

## DSP Implementation

All signal processing implemented in TypeScript — no third-party DSP libraries.

| Component | Algorithm |
|---|---|
| FFT | Radix-2 Cooley-Tukey (+ WebGPU compute shader) |
| Spectrogram | STFT with configurable window |
| Pitch | Normalized autocorrelation + parabolic interpolation + Viterbi |
| Formants | Burg LPC → polynomial root finding → bandwidth filtering |
| Noise reduction | Spectral subtraction (Boll 1979) |
| Filters | RBJ-style biquad IIR + Butterworth cascades |
| WAV export | PCM16 RIFF/WAVE encoding |

## References

- Boersma, P. & Weenink, D. (2024). *Praat: doing phonetics by computer.* https://www.praat.org/
- Boersma, P. (1993). Accurate short-term analysis of the fundamental period and the harmonics-to-noise ratio of a sampled sound. *IFA Proceedings 17*, 97–110.
- Burg, J.P. (1975). Maximum entropy spectral analysis. PhD thesis, Stanford University.
- Davis, S.B. & Mermelstein, P. (1980). Comparison of parametric representations for monosyllabic word recognition. *IEEE TASSP*, 28(4), 357–366.

## License

GPL-3.0
