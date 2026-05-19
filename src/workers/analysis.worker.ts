/**
 * Web Worker for heavy DSP analysis.
 * Runs analyzeAudio off the main thread to keep UI responsive.
 * Uses GPU FFT when WebGPU is available in the worker context.
 */
import { analyzeAudioWithProgress, analyzeAudioAsync } from '../audio/analyzer';
import { initFft, isGpuFftActive } from '../utils/fft-adapter';
import type { AnalysisSettings } from '../types';

export interface AnalysisWorkerRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
  settings: Partial<AnalysisSettings>;
}

// Initialize GPU FFT on worker startup
let gpuReady: Promise<boolean> | null = null;
try {
  gpuReady = initFft();
} catch {
  gpuReady = Promise.resolve(false);
}

self.onmessage = async (e: MessageEvent<AnalysisWorkerRequest>) => {
  const { id, samples, sampleRate, settings } = e.data;
  const onProgress = (value: number) => {
    self.postMessage({ type: 'progress', id, value });
  };

  // Wait for GPU probe to finish
  await gpuReady;

  let result;
  if (isGpuFftActive()) {
    result = await analyzeAudioAsync(samples, sampleRate, settings, onProgress);
  } else {
    result = analyzeAudioWithProgress(samples, sampleRate, settings, onProgress);
  }

  // Transfer large typed arrays for zero-copy
  const transferables: Transferable[] = [result.waveform.buffer];
  for (const mag of result.spectrogram.magnitudes) {
    transferables.push(mag.buffer);
  }
  self.postMessage({ type: 'result', id, result }, transferables as unknown as StructuredSerializeOptions);
};
