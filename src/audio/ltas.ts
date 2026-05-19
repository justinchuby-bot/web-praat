/**
 * LTAS (Long-Term Average Spectrum) — equivalent to Praat's Sound_to_Ltas.
 *
 * Computes the average power spectrum across all frames of the signal.
 * Unlike instantaneous spectrum, this gives a single curve representing
 * the long-term spectral shape.
 */

import { hammingWindow, fftMagnitude, batchFftMagnitude } from '../utils/fft';

export interface LtasData {
  /** Frequency values (Hz) for each bin */
  frequencies: Float64Array;
  /** Power spectral density in dB (averaged across all frames) */
  values: Float64Array;
  /** Nyquist frequency */
  maxFrequency: number;
  /** Frequency resolution (Hz per bin) */
  frequencyResolution: number;
}

export interface LtasSettings {
  /** FFT size (default 4096) */
  fftSize: number;
  /** Hop size as fraction of fftSize (default 0.5) */
  hopFraction: number;
  /** Maximum frequency to include in output (0 = Nyquist) */
  maxFrequency: number;
}

const defaultLtasSettings: LtasSettings = {
  fftSize: 4096,
  hopFraction: 0.5,
  maxFrequency: 0,
};

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, value)));
}

export function computeLtas(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<LtasSettings>
): LtasData {
  const s = { ...defaultLtasSettings, ...settings };
  const fftSize = nextPowerOfTwo(s.fftSize);
  const hopSize = Math.max(1, Math.round(fftSize * s.hopFraction));
  const bins = fftSize / 2 + 1;
  const nyquist = sampleRate / 2;
  const maxFreq = s.maxFrequency > 0 ? Math.min(s.maxFrequency, nyquist) : nyquist;

  // Accumulate power spectra
  const powerSum = new Float64Array(bins);
  let frameCount = 0;

  for (let start = 0; start + fftSize <= samples.length; start += hopSize) {
    // Extract frame
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frame[i] = samples[start + i];
    }

    // Window
    const windowed = hammingWindow(frame);

    // FFT magnitude
    const mag = fftMagnitude(windowed, fftSize);

    // Accumulate power (magnitude squared)
    for (let i = 0; i < bins; i++) {
      powerSum[i] += mag[i] * mag[i];
    }
    frameCount++;
  }

  // If signal is too short for even one frame, use zero-padded single frame
  if (frameCount === 0) {
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < Math.min(samples.length, fftSize); i++) {
      frame[i] = samples[i];
    }
    const windowed = hammingWindow(frame);
    const mag = fftMagnitude(windowed, fftSize);
    for (let i = 0; i < bins; i++) {
      powerSum[i] += mag[i] * mag[i];
    }
    frameCount = 1;
  }

  // Average and convert to dB
  const frequencyResolution = sampleRate / fftSize;
  const maxBin = Math.min(bins, Math.round(maxFreq / frequencyResolution) + 1);

  const frequencies = new Float64Array(maxBin);
  const values = new Float64Array(maxBin);

  for (let i = 0; i < maxBin; i++) {
    frequencies[i] = i * frequencyResolution;
    const avgPower = powerSum[i] / frameCount;
    values[i] = avgPower > 0 ? 10 * Math.log10(avgPower) : -100;
  }

  return {
    frequencies,
    values,
    maxFrequency: maxFreq,
    frequencyResolution,
  };
}

/**
 * GPU-accelerated LTAS computation using batch FFT.
 */
export async function computeLtasAsync(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<LtasSettings>
): Promise<LtasData> {
  const s = { ...defaultLtasSettings, ...settings };
  const fftSize = nextPowerOfTwo(s.fftSize);
  const hopSize = Math.max(1, Math.round(fftSize * s.hopFraction));
  const bins = fftSize / 2 + 1;
  const nyquist = sampleRate / 2;
  const maxFreq = s.maxFrequency > 0 ? Math.min(s.maxFrequency, nyquist) : nyquist;

  // Prepare all windowed frames
  const windowedFrames: Float64Array[] = [];
  for (let start = 0; start + fftSize <= samples.length; start += hopSize) {
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frame[i] = samples[start + i];
    }
    windowedFrames.push(hammingWindow(frame));
  }

  // Handle too-short signal
  if (windowedFrames.length === 0) {
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < Math.min(samples.length, fftSize); i++) {
      frame[i] = samples[i];
    }
    windowedFrames.push(hammingWindow(frame));
  }

  // Batch FFT
  const mags = await batchFftMagnitude(windowedFrames, fftSize);

  // Accumulate power
  const powerSum = new Float64Array(bins);
  for (let f = 0; f < mags.length; f++) {
    const mag = mags[f];
    for (let i = 0; i < bins; i++) {
      powerSum[i] += mag[i] * mag[i];
    }
  }

  const frameCount = mags.length;
  const frequencyResolution = sampleRate / fftSize;
  const maxBin = Math.min(bins, Math.round(maxFreq / frequencyResolution) + 1);

  const frequencies = new Float64Array(maxBin);
  const values = new Float64Array(maxBin);

  for (let i = 0; i < maxBin; i++) {
    frequencies[i] = i * frequencyResolution;
    const avgPower = powerSum[i] / frameCount;
    values[i] = avgPower > 0 ? 10 * Math.log10(avgPower) : -100;
  }

  return {
    frequencies,
    values,
    maxFrequency: maxFreq,
    frequencyResolution,
  };
}
