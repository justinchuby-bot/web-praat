/**
 * Cochleagram — auditory spectrogram using Bark scale re-binning.
 *
 * Simulates the frequency resolution of the human cochlea:
 * - Low frequencies get more bins (higher resolution)
 * - High frequencies are compressed
 * - Y-axis is in Bark scale (0–24 Bark ≈ 20 Hz–15.5 kHz)
 */

import type { SpectrogramData } from '../types';

/** Convert frequency (Hz) to Bark scale */
export function hzToBark(hz: number): number {
  return 26.81 * hz / (1960 + hz) - 0.53;
}

/** Convert Bark scale to frequency (Hz) */
export function barkToHz(bark: number): number {
  // Inverse of hzToBark (solving for hz)
  const b = bark + 0.53;
  return 1960 * b / (26.81 - b);
}

/** Convert frequency (Hz) to ERB rate */
export function hzToErb(hz: number): number {
  return 21.4 * Math.log10(1 + 0.00437 * hz);
}

/** Convert ERB rate to Hz */
export function erbToHz(erb: number): number {
  return (Math.pow(10, erb / 21.4) - 1) / 0.00437;
}

export interface CochleagramData {
  /** Bark-scale binned magnitudes per frame */
  magnitudes: Float64Array[];
  /** Number of Bark bins */
  numBarkBins: number;
  /** Time step between frames (seconds) */
  timeStep: number;
  /** Frame center times */
  frameTimes: number[];
  /** Center frequency (Hz) of each Bark bin */
  binFrequencies: number[];
  /** Bark value of each bin */
  binBarks: number[];
}

export interface CochleagramSettings {
  /** Number of Bark-scale bins (default: 64) */
  numBarkBins: number;
  /** Minimum frequency in Hz (default: 20) */
  minFreq: number;
  /** Maximum frequency in Hz (default: 15500) */
  maxFreq: number;
}

export const defaultCochleagramSettings: CochleagramSettings = {
  numBarkBins: 64,
  minFreq: 20,
  maxFreq: 15500,
};

/**
 * Compute a cochleagram from an existing linear spectrogram by re-binning
 * FFT magnitudes into Bark-scale frequency bands.
 */
export function computeCochleagram(
  spectrogram: SpectrogramData,
  settings: CochleagramSettings = defaultCochleagramSettings
): CochleagramData {
  const { numBarkBins, minFreq, maxFreq } = settings;
  const { magnitudes, maxFreq: spectrogramMaxFreq, frameTimes, timeStep } = spectrogram;

  const minBark = hzToBark(minFreq);
  const maxBark = hzToBark(Math.min(maxFreq, spectrogramMaxFreq));
  const barkStep = (maxBark - minBark) / numBarkBins;

  // Precompute bin center frequencies and bark values
  const binBarks: number[] = new Array(numBarkBins);
  const binFrequencies: number[] = new Array(numBarkBins);
  for (let b = 0; b < numBarkBins; b++) {
    binBarks[b] = minBark + (b + 0.5) * barkStep;
    binFrequencies[b] = barkToHz(binBarks[b]);
  }

  // Precompute the mapping: for each Bark bin, which linear FFT bins contribute
  const numLinearBins = magnitudes.length > 0 ? magnitudes[0].length : 0;
  const freqPerBin = spectrogramMaxFreq / (numLinearBins > 0 ? numLinearBins : 1);

  // For each bark bin, compute lower and upper FFT bin indices
  const barkBinRanges: Array<[number, number]> = new Array(numBarkBins);
  for (let b = 0; b < numBarkBins; b++) {
    const lowerHz = barkToHz(minBark + b * barkStep);
    const upperHz = barkToHz(minBark + (b + 1) * barkStep);
    const lowerBin = Math.max(0, Math.floor(lowerHz / freqPerBin));
    const upperBin = Math.min(numLinearBins - 1, Math.ceil(upperHz / freqPerBin));
    barkBinRanges[b] = [lowerBin, upperBin];
  }

  // Re-bin each frame
  const cochleaMagnitudes: Float64Array[] = new Array(magnitudes.length);
  for (let f = 0; f < magnitudes.length; f++) {
    const frame = magnitudes[f];
    const barkFrame = new Float64Array(numBarkBins);
    for (let b = 0; b < numBarkBins; b++) {
      const [lo, hi] = barkBinRanges[b];
      if (lo > hi) continue;
      let sum = 0;
      let count = 0;
      for (let i = lo; i <= hi; i++) {
        sum += frame[i];
        count++;
      }
      barkFrame[b] = count > 0 ? sum / count : 0;
    }
    cochleaMagnitudes[f] = barkFrame;
  }

  return {
    magnitudes: cochleaMagnitudes,
    numBarkBins,
    timeStep,
    frameTimes,
    binFrequencies,
    binBarks,
  };
}
