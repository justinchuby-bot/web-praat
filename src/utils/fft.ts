/**
 * Radix-2 Cooley-Tukey FFT implementation.
 * All algorithms implemented from scratch — no external libraries.
 */

/**
 * Compute FFT of a real-valued signal (zero-padded to fftSize).
 * Returns magnitude spectrum (first fftSize/2 + 1 bins).
 */
export function fftMagnitude(signal: Float64Array, fftSize: number): Float64Array {
  const n = fftSize;
  // Zero-pad or truncate
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < Math.min(signal.length, n); i++) {
    re[i] = signal[i];
  }

  fftInPlace(re, im);

  const bins = n / 2 + 1;
  const mag = new Float64Array(bins);
  for (let i = 0; i < bins; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mag;
}

/**
 * In-place radix-2 FFT. Arrays must be power-of-2 length.
 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly passes
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angleStep = -2 * Math.PI / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k;
        const twRe = Math.cos(angle);
        const twIm = Math.sin(angle);
        const evenIdx = i + k;
        const oddIdx = i + k + halfSize;
        const tRe = twRe * re[oddIdx] - twIm * im[oddIdx];
        const tIm = twRe * im[oddIdx] + twIm * re[oddIdx];
        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] += tRe;
        im[evenIdx] += tIm;
      }
    }
  }
}

/**
 * In-place inverse FFT. Conjugate → FFT → conjugate → scale by 1/N.
 */
export function ifftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Conjugate
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fftInPlace(re, im);
  // Conjugate and scale
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] = -im[i] / n;
  }
}

/**
 * Apply Hamming window to a signal.
 */
export function hammingWindow(signal: Float64Array): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = signal[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return out;
}

/**
 * Apply Hanning (Hann) window to a signal.
 */
export function hanningWindow(signal: Float64Array): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = signal[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return out;
}

/**
 * Apply Gaussian window (sigma = 0.4) to a signal.
 */
export function gaussianWindow(signal: Float64Array): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);
  const sigma = 0.4;
  for (let i = 0; i < N; i++) {
    const t = (i - (N - 1) / 2) / ((N - 1) / 2 / (1 / sigma));
    out[i] = signal[i] * Math.exp(-0.5 * t * t);
  }
  return out;
}

/**
 * Apply Bartlett (triangular) window to a signal.
 */
export function bartlettWindow(signal: Float64Array): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = signal[i] * (1 - Math.abs((2 * i - (N - 1)) / (N - 1)));
  }
  return out;
}

/**
 * Apply the specified window function.
 */
export function applyWindow(signal: Float64Array, windowType: string): Float64Array {
  switch (windowType) {
    case 'hamming': return hammingWindow(signal);
    case 'hanning': return hanningWindow(signal);
    case 'gaussian': return gaussianWindow(signal);
    case 'bartlett': return bartlettWindow(signal);
    case 'rectangular': return Float64Array.from(signal);
    default: return hanningWindow(signal);
  }
}

/**
 * Apply pre-emphasis filter: y[n] = x[n] - alpha * x[n-1]
 */
export function preEmphasis(signal: Float64Array, factorDb: number): Float64Array {
  if (factorDb <= 0) return signal;
  // Convert dB/octave to coefficient (Praat uses 6 dB/oct → alpha ≈ 0.97)
  const alpha = 1 - Math.pow(10, -factorDb / 20);
  const out = new Float64Array(signal.length);
  out[0] = signal[0];
  for (let i = 1; i < signal.length; i++) {
    out[i] = signal[i] - alpha * signal[i - 1];
  }
  return out;
}

// ─── GPU-accelerated unified interface ─────────────────────────────────────────

import { isGpuAvailable, fftMagnitudeGpu, initGpuFft } from './fft-gpu';

export { initGpuFft, isGpuAvailable };

/**
 * Unified FFT entry point — automatically uses GPU when available, CPU fallback.
 */
export async function fftMagnitudeAuto(
  signal: Float64Array,
  fftSize: number
): Promise<Float64Array> {
  if (isGpuAvailable()) {
    return fftMagnitudeGpu(signal, fftSize);
  }
  return fftMagnitude(signal, fftSize);
}

/**
 * Batch FFT — process multiple frames at once. GPU-optimal path.
 * Falls back to sequential CPU if GPU unavailable.
 */
export async function batchFftMagnitude(
  frames: Float64Array[],
  fftSize: number
): Promise<Float64Array[]> {
  // GPU batch FFT disabled — has data layout bug causing horizontal banding
  // GPU per-frame still works for individual fftMagnitudeAuto calls
  return frames.map(frame => fftMagnitude(frame, fftSize));
}
