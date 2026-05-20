# Acoustic Analysis Methods

This document describes the algorithms used in web-praat for reproducibility and citation purposes.

## Pitch (F0) Estimation

**Algorithm:** Normalized autocorrelation with Viterbi path tracking.

- Frame size: 40 ms (Hamming window)
- Hop size: 10 ms
- Candidate detection: local maxima in normalized autocorrelation
- Sub-sample refinement: parabolic interpolation
- Path optimization: dynamic programming (Viterbi) with transition costs penalizing octave jumps
- Default range: 75–600 Hz

**Reference:** Boersma, P. (1993). "Accurate short-term analysis of the fundamental period and the harmonics-to-noise ratio of a sampled sound." *Proceedings of the Institute of Phonetic Sciences, University of Amsterdam*, 17, 97–110.

**Validation:** Tested on synthetic signals. Accuracy ±2 Hz for pure tones, ±3 Hz for voice-like signals across 80–250 Hz range. See `tests/validation/acoustic-validation.test.ts`.

---

## Formant Estimation

**Algorithm:** Linear Predictive Coding (Burg method) with root-finding.

- Frame size: 25 ms (Hanning window)
- Hop size: 10 ms
- LPC order: 12 (default; user-configurable)
- Formant extraction: roots of the LPC polynomial, filtered by bandwidth
- Maximum formant frequency: 5500 Hz (default)
- Pre-emphasis: 50 Hz (6 dB/octave)

**Reference:** Burg, J.P. (1975). "Maximum entropy spectral analysis." PhD thesis, Stanford University.

**Validation:** Tested on impulse-train + resonator models of /a/ (F1≈700, F2≈1200), /i/ (F1≈270, F2≈2300), and /u/ (F1≈300, F2≈870). Accuracy ±100 Hz for F1, ±150 Hz for F2.

---

## Intensity

**Algorithm:** RMS energy in dB SPL (re: 2×10⁻⁵ Pa equivalent).

- Frame size: 32 ms
- Hop size: 16 ms
- Formula: `intensity_dB = 10 * log10(mean(x²) / ref²)`

**Reference:** Standard acoustic measurement. See IEC 61672-1:2013.

**Validation:** Verified monotonic relationship with amplitude. 8× amplitude ratio → ~18 dB difference (expected: 20*log10(8) = 18.06 dB). Frequency-independent within ±2 dB.

---

## Harmonicity (HNR)

**Algorithm:** Autocorrelation-based harmonics-to-noise ratio.

- Computed from normalized autocorrelation peak
- Formula: `HNR_dB = 10 * log10(r_max / (1 - r_max))`
- Where `r_max` is the maximum autocorrelation coefficient at the fundamental period

**Reference:** Boersma, P. (1993). See Pitch reference above.

**Validation:** Pure tones yield HNR > 20 dB; white noise yields HNR < 5 dB.

---

## Spectrogram

**Algorithm:** Short-Time Fourier Transform (STFT) with configurable window.

- Window functions: Hanning (default), Hamming, Blackman, Gaussian
- FFT size: 256–8192 (configurable)
- Display: power spectral density in dB, configurable dynamic range (default 70 dB)
- Rendering: bilinear interpolation for smooth display
- GPU acceleration: WebGPU compute shader when available

---

## MFCC (Mel-Frequency Cepstral Coefficients)

**Algorithm:** Standard MFCC pipeline.

1. Pre-emphasis (α = 0.97)
2. STFT (frame size 25 ms, hop 10 ms)
3. Mel filterbank (26 triangular filters)
4. Log energy per filter
5. DCT → 13 cepstral coefficients (C0 excluded by default)

**Reference:** Davis, S.B. & Mermelstein, P. (1980). "Comparison of parametric representations for monosyllabic word recognition in continuously spoken sentences." *IEEE Transactions on Acoustics, Speech, and Signal Processing*, 28(4), 357–366.

---

## Noise Reduction

**Algorithm:** Spectral subtraction with overlap-add reconstruction.

- Noise estimation: first 0.5s assumed noise-only
- Frame size: 1024 samples
- Hop size: 256 samples
- Spectral floor: 1% of original magnitude (prevents musical noise)
- GPU acceleration: WebGPU FFT when available; CPU fallback

**Reference:** Boll, S.F. (1979). "Suppression of acoustic noise in speech using spectral subtraction." *IEEE Transactions on Acoustics, Speech, and Signal Processing*, 27(2), 113–120.

---

## How to Cite

If you use web-praat in academic work, please cite:

```
web-praat: A browser-based acoustic analysis tool.
https://github.com/justinchuby/web-praat
```

For individual algorithms, please cite the original references listed above.
