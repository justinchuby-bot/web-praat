/**
 * Web Worker for heavy DSP analysis.
 * Runs analyzeAudio off the main thread to keep UI responsive.
 */
import { analyzeAudioWithProgress } from '../audio/analyzer';
import type { AnalysisSettings } from '../types';

export interface AnalysisWorkerRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
  settings: Partial<AnalysisSettings>;
}

self.onmessage = (e: MessageEvent<AnalysisWorkerRequest>) => {
  const { id, samples, sampleRate, settings } = e.data;
  const onProgress = (value: number) => {
    self.postMessage({ type: 'progress', id, value });
  };
  const result = analyzeAudioWithProgress(samples, sampleRate, settings, onProgress);
  // Transfer large typed arrays for zero-copy
  const transferables: Transferable[] = [result.waveform.buffer];
  for (const mag of result.spectrogram.magnitudes) {
    transferables.push(mag.buffer);
  }
  self.postMessage({ type: 'result', id, result }, transferables as unknown as StructuredSerializeOptions);
};
