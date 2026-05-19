/**
 * MFCC (Mel-Frequency Cepstral Coefficients) computation.
 * Standard implementation: windowing → FFT → Mel filterbank → log → DCT.
 */

import { fftMagnitude, hammingWindow } from '../utils/fft';

export interface MfccResult {
  /** MFCC matrix: [frameIndex][coeffIndex] */
  coefficients: number[][];
  /** Time of each frame center (seconds) */
  times: number[];
  /** Number of coefficients per frame */
  numCoeffs: number;
}

export interface MfccOptions {
  /** Number of MFCC coefficients (default 13) */
  numCoeffs?: number;
  /** FFT size (default 512) */
  fftSize?: number;
  /** Hop size in samples (default 160) */
  hopSize?: number;
  /** Number of Mel filter bands (default 26) */
  numFilters?: number;
  /** Lower frequency bound (default 0) */
  lowFreq?: number;
  /** Upper frequency bound (default sampleRate/2) */
  highFreq?: number;
}

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Build triangular Mel filterbank weights.
 * Returns array of numFilters arrays, each of length fftBins.
 */
function melFilterbank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  lowFreq: number,
  highFreq: number
): number[][] {
  const fftBins = fftSize / 2 + 1;
  const melLow = hzToMel(lowFreq);
  const melHigh = hzToMel(highFreq);
  // numFilters + 2 points for triangular filters
  const melPoints = new Float64Array(numFilters + 2);
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = melLow + (i * (melHigh - melLow)) / (numFilters + 1);
  }
  const binPoints = melPoints.map(m => Math.floor(((melToHz(m) * fftSize) / sampleRate)));

  const filters: number[][] = [];
  for (let m = 0; m < numFilters; m++) {
    const filter = new Array<number>(fftBins).fill(0);
    const start = binPoints[m];
    const center = binPoints[m + 1];
    const end = binPoints[m + 2];
    for (let k = start; k < center; k++) {
      if (k >= 0 && k < fftBins) {
        filter[k] = (k - start) / (center - start || 1);
      }
    }
    for (let k = center; k <= end; k++) {
      if (k >= 0 && k < fftBins) {
        filter[k] = (end - k) / (end - center || 1);
      }
    }
    filters.push(filter);
  }
  return filters;
}

/**
 * Compute MFCCs for an audio signal.
 */
export function computeMfcc(
  samples: Float32Array,
  sampleRate: number,
  options?: MfccOptions
): MfccResult {
  const numCoeffs = options?.numCoeffs ?? 13;
  const fftSize = nextPowerOfTwo(options?.fftSize ?? 512);
  const hopSize = options?.hopSize ?? 160;
  const numFilters = options?.numFilters ?? 26;
  const lowFreq = options?.lowFreq ?? 0;
  const highFreq = options?.highFreq ?? sampleRate / 2;

  const filters = melFilterbank(numFilters, fftSize, sampleRate, lowFreq, highFreq);
  const fftBins = fftSize / 2 + 1;

  const totalFrames = Math.max(0, Math.floor((samples.length - fftSize) / hopSize) + 1);
  const coefficients: number[][] = [];
  const times: number[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const start = f * hopSize;
    // Extract and window frame
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frame[i] = start + i < samples.length ? samples[start + i] : 0;
    }
    const windowed = hammingWindow(frame);

    // Power spectrum
    const mag = fftMagnitude(windowed, fftSize);
    const power = new Float64Array(fftBins);
    for (let i = 0; i < fftBins; i++) {
      power[i] = (mag[i] * mag[i]) / fftSize;
    }

    // Apply Mel filterbank
    const melEnergies = new Float64Array(numFilters);
    for (let m = 0; m < numFilters; m++) {
      let sum = 0;
      for (let k = 0; k < fftBins; k++) {
        sum += filters[m][k] * power[k];
      }
      melEnergies[m] = Math.log(Math.max(sum, 1e-10));
    }

    // DCT-II to get cepstral coefficients
    const cepstral: number[] = [];
    for (let n = 0; n < numCoeffs; n++) {
      let sum = 0;
      for (let m = 0; m < numFilters; m++) {
        sum += melEnergies[m] * Math.cos((Math.PI * n * (m + 0.5)) / numFilters);
      }
      cepstral.push(sum);
    }

    coefficients.push(cepstral);
    times.push((start + fftSize / 2) / sampleRate);
  }

  return { coefficients, times, numCoeffs };
}
