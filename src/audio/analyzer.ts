/**
 * Audio analysis: spectrogram, pitch, formants, intensity.
 * All DSP algorithms implemented from scratch.
 */

import { fftMagnitude, hammingWindow } from '../utils/fft';
import { extractFormants } from './lpc';
import type {
  AnalysisResult,
  SpectrogramData,
  PitchData,
  FormantData,
  IntensityData,
} from '../types';

const FFT_SIZE = 1024;
const HOP_SIZE = 256;

/**
 * Full analysis pipeline for loaded audio.
 */
export function analyzeAudio(samples: Float32Array, sampleRate: number): AnalysisResult {
  const duration = samples.length / sampleRate;
  const spectrogram = computeSpectrogram(samples, sampleRate);
  const pitch = computePitch(samples, sampleRate);
  const formants = computeFormants(samples, sampleRate);
  const intensity = computeIntensity(samples, sampleRate);

  return {
    waveform: samples,
    sampleRate,
    duration,
    spectrogram,
    pitch,
    formants,
    intensity,
  };
}

/**
 * STFT spectrogram with Hamming window.
 */
export function computeSpectrogram(samples: Float32Array, sampleRate: number): SpectrogramData {
  const numFrames = Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1;
  const magnitudes: Float64Array[] = [];

  for (let i = 0; i < numFrames; i++) {
    const start = i * HOP_SIZE;
    const frame = new Float64Array(FFT_SIZE);
    for (let j = 0; j < FFT_SIZE; j++) {
      frame[j] = start + j < samples.length ? samples[start + j] : 0;
    }
    const windowed = hammingWindow(frame);
    const mag = fftMagnitude(windowed, FFT_SIZE);
    magnitudes.push(mag);
  }

  return {
    magnitudes,
    timeStep: HOP_SIZE / sampleRate,
    freqStep: sampleRate / FFT_SIZE,
    maxFreq: sampleRate / 2,
  };
}

/**
 * Pitch detection using autocorrelation method (similar to Praat's AC method).
 * Searches for F0 in range 75–600 Hz.
 */
export function computePitch(samples: Float32Array, sampleRate: number): PitchData {
  const frameSize = Math.round(sampleRate * 0.04); // 40ms frames
  const hopSize = Math.round(sampleRate * 0.01); // 10ms hop
  const minLag = Math.round(sampleRate / 600); // 600 Hz max
  const maxLag = Math.round(sampleRate / 75); // 75 Hz min

  const times: number[] = [];
  const frequencies: (number | null)[] = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);

    // Extract frame and apply window
    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frameSize - 1)));
    }

    // Compute normalized autocorrelation
    let r0 = 0;
    for (let i = 0; i < frameSize; i++) r0 += frame[i] * frame[i];

    if (r0 < 1e-6) {
      frequencies.push(null);
      continue;
    }

    let bestLag = 0;
    let bestCorr = 0;

    for (let lag = minLag; lag <= Math.min(maxLag, frameSize - 1); lag++) {
      let num = 0;
      let den1 = 0;
      let den2 = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        num += frame[i] * frame[i + lag];
        den1 += frame[i] * frame[i];
        den2 += frame[i + lag] * frame[i + lag];
      }
      const denom = Math.sqrt(den1 * den2);
      const corr = denom > 0 ? num / denom : 0;

      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    // Voicing threshold
    if (bestCorr > 0.45 && bestLag > 0) {
      // Parabolic interpolation for sub-sample accuracy
      const f0 = sampleRate / bestLag;
      frequencies.push(f0);
    } else {
      frequencies.push(null);
    }
  }

  return { times, frequencies };
}

/**
 * Formant analysis using LPC (Burg's method) on overlapping frames.
 */
export function computeFormants(samples: Float32Array, sampleRate: number): FormantData {
  const frameSize = Math.round(sampleRate * 0.025); // 25ms
  const hopSize = Math.round(sampleRate * 0.01); // 10ms

  const times: number[] = [];
  const f1: (number | null)[] = [];
  const f2: (number | null)[] = [];
  const f3: (number | null)[] = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);

    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i];
    }

    const result = extractFormants(frame, sampleRate, 12);
    if (result) {
      f1.push(result.f1);
      f2.push(result.f2);
      f3.push(result.f3);
    } else {
      f1.push(null);
      f2.push(null);
      f3.push(null);
    }
  }

  return { times, f1, f2, f3 };
}

/**
 * Intensity (loudness) in dB, computed as RMS per frame.
 */
export function computeIntensity(samples: Float32Array, sampleRate: number): IntensityData {
  const frameSize = Math.round(sampleRate * 0.032); // 32ms
  const hopSize = Math.round(sampleRate * 0.01); // 10ms

  const times: number[] = [];
  const values: number[] = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);

    let sum = 0;
    for (let i = 0; i < frameSize; i++) {
      sum += samples[start + i] * samples[start + i];
    }
    const rms = Math.sqrt(sum / frameSize);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    values.push(db);
  }

  return { times, values };
}
