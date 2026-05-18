/**
 * Harmonicity (HNR) analysis — equivalent to Praat's Sound_to_Harmonicity_ac.
 *
 * For each frame, we compute the normalized autocorrelation at the best pitch lag.
 * The autocorrelation strength r is converted to HNR in dB:
 *   HNR = 10 * log10(r / (1 - r))
 *
 * Unvoiced frames get HNR = -200 (Praat convention).
 */

import { hammingWindow } from '../utils/fft';

export interface HarmonicityData {
  times: number[];
  /** HNR in dB per frame. -200 means unvoiced/silent. */
  values: number[];
  meanHnrDb: number;
  medianHnrDb: number;
}

export interface HarmonicitySettings {
  timeStep: number;       // seconds (default 0.01)
  pitchFloor: number;     // Hz (default 75)
  pitchCeiling: number;   // Hz (default 500)
  silenceThreshold: number; // default 0.1
  periodsPerWindow: number; // default 4.5
}

export const defaultHarmonicitySettings: HarmonicitySettings = {
  timeStep: 0.01,
  pitchFloor: 75,
  pitchCeiling: 500,
  silenceThreshold: 0.1,
  periodsPerWindow: 4.5,
};

export function computeHarmonicity(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<HarmonicitySettings>
): HarmonicityData {
  const s = { ...defaultHarmonicitySettings, ...settings };
  const hopSize = Math.max(1, Math.round(sampleRate * s.timeStep));
  const windowDuration = s.periodsPerWindow / s.pitchFloor;
  const frameSize = Math.round(sampleRate * windowDuration);
  const minLag = Math.round(sampleRate / s.pitchCeiling);
  const maxLag = Math.round(sampleRate / s.pitchFloor);

  const times: number[] = [];
  const values: number[] = [];

  // Compute global RMS for silence threshold
  let globalEnergy = 0;
  for (let i = 0; i < samples.length; i++) globalEnergy += samples[i] * samples[i];
  const globalRms = Math.sqrt(globalEnergy / samples.length);

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);

    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) frame[i] = samples[start + i];

    const windowed = hammingWindow(frame);

    // Check silence
    let energy = 0;
    for (let i = 0; i < windowed.length; i++) energy += windowed[i] * windowed[i];
    const rms = Math.sqrt(energy / windowed.length);
    if (globalRms > 0 && rms / globalRms < s.silenceThreshold) {
      values.push(-200);
      continue;
    }

    // Normalized autocorrelation to find best pitch lag
    let bestR = 0;
    for (let lag = minLag; lag <= Math.min(maxLag, frameSize - 1); lag++) {
      let num = 0;
      let d1 = 0;
      let d2 = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        num += windowed[i] * windowed[i + lag];
        d1 += windowed[i] * windowed[i];
        d2 += windowed[i + lag] * windowed[i + lag];
      }
      const denom = Math.sqrt(d1 * d2);
      const r = denom > 0 ? num / denom : 0;
      if (r > bestR) bestR = r;
    }

    // Convert autocorrelation strength to HNR (dB)
    if (bestR <= 1e-15) {
      values.push(-200);
    } else if (bestR > 1 - 1e-15) {
      values.push(150);
    } else {
      values.push(10 * Math.log10(bestR / (1 - bestR)));
    }
  }

  // Statistics (only sounding frames)
  const sounding = values.filter(v => v !== -200);
  const meanHnrDb = sounding.length > 0 ? sounding.reduce((a, b) => a + b, 0) / sounding.length : -200;
  const sorted = [...sounding].sort((a, b) => a - b);
  const medianHnrDb = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : -200;

  return { times, values, meanHnrDb, medianHnrDb };
}
