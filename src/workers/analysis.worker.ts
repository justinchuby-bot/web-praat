/**
 * Web Worker for heavy DSP analysis.
 * Runs analyzeAudio off the main thread to keep UI responsive.
 */
import { analyzeAudio } from '../audio/analyzer';
import type { AnalysisSettings } from '../types';

export interface AnalysisWorkerRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
  settings: Partial<AnalysisSettings>;
}

self.onmessage = (e: MessageEvent<AnalysisWorkerRequest>) => {
  const { id, samples, sampleRate, settings } = e.data;
  const result = analyzeAudio(samples, sampleRate, settings);
  // Transfer large typed arrays for zero-copy
  const transferables: Transferable[] = [result.waveform.buffer];
  for (const mag of result.spectrogram.magnitudes) {
    transferables.push(mag.buffer);
  }
  self.postMessage({ id, result }, transferables as unknown as StructuredSerializeOptions);
};
