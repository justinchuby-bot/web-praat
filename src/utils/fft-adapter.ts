/**
 * FFT adapter — provides a unified interface that auto-selects GPU or CPU FFT.
 *
 * Usage:
 *   await initFft();  // call once at startup
 *   const mag = await fftMagnitudeAuto(signal, fftSize);
 *
 * When WebGPU is available, uses GPU-accelerated FFT.
 * Otherwise falls back to CPU implementation transparently.
 */

import { fftMagnitude as cpuFftMagnitude } from './fft';
import { initGpuFft, isGpuAvailable, fftMagnitudeGpu } from './fft-gpu';

let initialized = false;

/**
 * Initialize the FFT subsystem. Probes WebGPU availability.
 * Safe to call multiple times (idempotent).
 * Returns true if GPU FFT is active.
 */
export async function initFft(): Promise<boolean> {
  if (initialized) return isGpuAvailable();
  initialized = true;
  try {
    return await initGpuFft();
  } catch {
    return false;
  }
}

/**
 * Returns whether GPU FFT is currently active.
 */
export function isGpuFftActive(): boolean {
  return isGpuAvailable();
}

/**
 * Compute FFT magnitude — uses GPU when available, CPU otherwise.
 * Async because GPU path requires awaiting buffer readback.
 */
export async function fftMagnitudeAuto(
  signal: Float64Array,
  fftSize: number,
): Promise<Float64Array> {
  if (isGpuAvailable()) {
    return fftMagnitudeGpu(signal, fftSize);
  }
  return cpuFftMagnitude(signal, fftSize);
}

/**
 * Batch FFT — compute multiple frames in sequence (GPU) or parallel (CPU).
 * More efficient than calling fftMagnitudeAuto in a loop when using GPU
 * because we can potentially batch GPU submissions.
 */
export async function fftMagnitudeBatch(
  frames: Float64Array[],
  fftSize: number,
): Promise<Float64Array[]> {
  if (!isGpuAvailable()) {
    // CPU: just map synchronously
    return frames.map((f) => cpuFftMagnitude(f, fftSize));
  }
  // GPU: process sequentially (each already uses GPU pipeline)
  // Future optimization: batch all frames in a single GPU dispatch
  const results: Float64Array[] = [];
  for (const frame of frames) {
    results.push(await fftMagnitudeGpu(frame, fftSize));
  }
  return results;
}
