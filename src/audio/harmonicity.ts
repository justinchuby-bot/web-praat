/**
 * Harmonicity (HNR) analysis — equivalent to Praat's Sound_to_Harmonicity_ac.
 *
 * For each frame, we compute the normalized autocorrelation at the best pitch lag.
 * The autocorrelation strength r is converted to HNR in dB:
 *   HNR = 10 * log10(r / (1 - r))
 *
 * Key to matching Praat: the autocorrelation is normalized by dividing by
 * R_signal(0) * R_window(lag), where R_window is the autocorrelation of
 * the window function itself. This compensates for the tapering of the
 * Hanning window and allows r to approach 1.0 for periodic signals.
 *
 * Unvoiced frames get HNR = -200 (Praat convention).
 */

import { hanningWindow } from '../utils/fft';

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

const defaultHarmonicitySettings: HarmonicitySettings = {
  timeStep: 0.01,
  pitchFloor: 75,
  pitchCeiling: 500,
  silenceThreshold: 0.1,
  periodsPerWindow: 4.5,
};

/**
 * Compute autocorrelation of the Hanning window for normalization.
 * windowR[lag] = R_window(lag) / R_window(0)
 */
function computeWindowAutocorrelation(windowSize: number, maxLag: number): Float64Array {
  // Generate the Hanning window
  const win = new Float64Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (windowSize - 1));
  }

  // Compute R_window(0)
  let r0 = 0;
  for (let i = 0; i < windowSize; i++) r0 += win[i] * win[i];

  // Compute normalized autocorrelation for each lag
  const windowR = new Float64Array(maxLag + 1);
  windowR[0] = 1.0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < windowSize - lag; i++) {
      sum += win[i] * win[i + lag];
    }
    windowR[lag] = sum / r0;
  }
  return windowR;
}

/**
 * Sinc interpolation (Whittaker-Shannon) for more precise peak finding.
 * Interpolates r[index + dx] from the r array.
 */
function sincInterpolate(r: Float64Array, minLag: number, maxLag: number, x: number, depth: number): number {
  let sum = 0;
  const left = Math.max(minLag, Math.floor(x) - depth);
  const right = Math.min(maxLag, Math.ceil(x) + depth);
  for (let i = left; i <= right; i++) {
    const dx = x - i;
    if (Math.abs(dx) < 1e-12) {
      sum += r[i];
    } else {
      // sinc(dx) = sin(pi*dx)/(pi*dx)
      const sinc = Math.sin(Math.PI * dx) / (Math.PI * dx);
      sum += r[i] * sinc;
    }
  }
  return sum;
}

export function computeHarmonicity(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<HarmonicitySettings>
): HarmonicityData {
  const s = { ...defaultHarmonicitySettings, ...settings };
  const hopSize = Math.max(1, Math.round(sampleRate * s.timeStep));
  const windowDuration = s.periodsPerWindow / s.pitchFloor;
  const frameSize = Math.round(sampleRate * windowDuration);
  const minLag = Math.max(2, Math.round(sampleRate / s.pitchCeiling));
  const maxLag = Math.round(sampleRate / s.pitchFloor);

  // Precompute window autocorrelation for normalization
  const windowR = computeWindowAutocorrelation(frameSize, maxLag);

  const times: number[] = [];
  const values: number[] = [];

  // Compute global peak for silence threshold (Praat uses peak, not RMS)
  let globalPeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > globalPeak) globalPeak = v;
  }

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);

    // Subtract local mean (Praat does this)
    let localMean = 0;
    for (let i = 0; i < frameSize; i++) localMean += samples[start + i];
    localMean /= frameSize;

    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) frame[i] = samples[start + i] - localMean;

    // Apply Hanning window
    const windowed = hanningWindow(frame);

    // Check local peak for silence
    let localPeak = 0;
    for (let i = 0; i < windowed.length; i++) {
      const v = Math.abs(windowed[i]);
      if (v > localPeak) localPeak = v;
    }
    if (globalPeak > 0 && localPeak / globalPeak < s.silenceThreshold) {
      values.push(-200);
      continue;
    }

    // Compute R(0) — the autocorrelation at lag 0 (energy of windowed signal)
    let r0 = 0;
    for (let i = 0; i < frameSize; i++) r0 += windowed[i] * windowed[i];

    if (r0 === 0) {
      values.push(-200);
      continue;
    }

    // Compute normalized autocorrelation: r(lag) = R(lag) / (R(0) * windowR(lag))
    // This is the Praat method — dividing by windowR compensates for window tapering
    const effectiveMaxLag = Math.min(maxLag, frameSize - 1);
    const rValues = new Float64Array(effectiveMaxLag + 1);
    rValues[0] = 1.0;

    for (let lag = 1; lag <= effectiveMaxLag; lag++) {
      let num = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        num += windowed[i] * windowed[i + lag];
      }
      // Normalize by R(0) and window autocorrelation
      const wR = windowR[lag];
      rValues[lag] = wR > 1e-15 ? num / (r0 * wR) : 0;
    }

    // Find the best peak in the pitch range
    let bestR = 0;
    let bestLag = minLag;
    for (let lag = minLag; lag <= effectiveMaxLag; lag++) {
      if (rValues[lag] > rValues[lag - 1] && rValues[lag] >= rValues[lag + 1] && rValues[lag] > bestR) {
        bestR = rValues[lag];
        bestLag = lag;
      }
    }

    // If no peak found, just use the max value
    if (bestR <= 0) {
      for (let lag = minLag; lag <= effectiveMaxLag; lag++) {
        if (rValues[lag] > bestR) {
          bestR = rValues[lag];
          bestLag = lag;
        }
      }
    }

    // Parabolic interpolation for sub-sample peak location
    if (bestLag > minLag && bestLag < effectiveMaxLag && bestR > 0) {
      const yl = rValues[bestLag - 1];
      const yc = rValues[bestLag];
      const yr = rValues[bestLag + 1];
      const d2r = (yc - yl) + (yc - yr); // = 2*yc - yl - yr
      if (d2r > 0) {
        const dr = 0.5 * (yr - yl);
        const fractionalLag = bestLag + dr / d2r;

        // Use sinc interpolation at the refined position for more accurate strength
        const interpR = sincInterpolate(rValues, minLag > 1 ? minLag - 1 : 0, effectiveMaxLag, fractionalLag, 30);
        if (interpR > bestR) {
          bestR = interpR;
        }
      }
    }

    // Clamp: values > 1 are reflected around 1 (Praat convention)
    if (bestR > 1.0) bestR = 1.0 / bestR;

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
