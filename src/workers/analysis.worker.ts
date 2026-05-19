/**
 * Web Worker for heavy DSP analysis.
 * Runs analyzeAudio off the main thread to keep UI responsive.
 * Uses GPU-accelerated FFT when WebGPU is available.
 */
import { analyzeAudioAsync } from '../audio/analyzer';
import { initGpuFft } from '../utils/fft-gpu';
import type { AnalysisSettings } from '../types';

export interface AnalysisWorkerRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
  settings: Partial<AnalysisSettings>;
}

// Initialize GPU in worker context
let gpuReady: Promise<boolean> | null = null;

self.onmessage = async (e: MessageEvent<AnalysisWorkerRequest>) => {
  const { id, samples, sampleRate, settings } = e.data;
  const onProgress = (value: number) => {
    self.postMessage({ type: 'progress', id, value });
  };

  // Lazily init GPU once
  if (!gpuReady) {
    gpuReady = initGpuFft();
  }
  await gpuReady;

  // Use async (GPU-accelerated) path
  const result = await analyzeAudioAsync(samples, sampleRate, settings, onProgress);

  // Transfer large typed arrays for zero-copy
  const transferables: Transferable[] = [result.waveform.buffer];
  for (const mag of result.spectrogram.magnitudes) {
    transferables.push(mag.buffer);
  }
  self.postMessage({ type: 'result', id, result }, transferables as unknown as StructuredSerializeOptions);
};
