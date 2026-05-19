import type { FilterSettings, FilterType } from '../types';
import { fftInPlace } from '../utils/fft';

// ─── Biquad (2nd-order IIR) ─────────────────────────────────────────────────

interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function normalizeCoefficients(
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number
): BiquadCoefficients {
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

export function designBiquad(
  type: Exclude<FilterType, 'none'>,
  sampleRate: number,
  cutoffHz: number,
  q = Math.SQRT1_2
): BiquadCoefficients {
  const omega = (2 * Math.PI * cutoffHz) / sampleRate;
  const sin = Math.sin(omega);
  const cos = Math.cos(omega);
  const alpha = sin / (2 * Math.max(q, 1e-6));

  if (type === 'lowpass') {
    return normalizeCoefficients(
      (1 - cos) / 2,
      1 - cos,
      (1 - cos) / 2,
      1 + alpha,
      -2 * cos,
      1 - alpha
    );
  }

  if (type === 'highpass') {
    return normalizeCoefficients(
      (1 + cos) / 2,
      -(1 + cos),
      (1 + cos) / 2,
      1 + alpha,
      -2 * cos,
      1 - alpha
    );
  }

  if (type === 'notch') {
    return normalizeCoefficients(
      1,
      -2 * cos,
      1,
      1 + alpha,
      -2 * cos,
      1 - alpha
    );
  }

  // bandpass
  return normalizeCoefficients(
    alpha,
    0,
    -alpha,
    1 + alpha,
    -2 * cos,
    1 - alpha
  );
}

function applyBiquadOnce(
  input: Float32Array,
  coeffs: BiquadCoefficients
): Float32Array {
  const output = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2
             - coeffs.a1 * y1 - coeffs.a2 * y2;
    output[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }
  return output;
}

export function applyBiquadFilter(
  input: Float32Array,
  sampleRate: number,
  settings: FilterSettings
): Float32Array {
  if (settings.type === 'none') {
    return Float32Array.from(input);
  }
  const coeffs = designBiquad(settings.type, sampleRate, settings.cutoffHz, settings.q);
  return applyBiquadOnce(input, coeffs);
}

// ─── Higher-order Butterworth ────────────────────────────────────────────────

/**
 * Design a cascaded biquad Butterworth filter of given order.
 * Returns array of biquad sections to apply in series.
 */
export function designButterworth(
  type: 'lowpass' | 'highpass' | 'bandpass',
  order: number,
  sampleRate: number,
  cutoffHz: number,
  bandwidthHz?: number
): BiquadCoefficients[] {
  const sections: BiquadCoefficients[] = [];
  const effectiveOrder = Math.max(1, Math.round(order));

  if (type === 'bandpass') {
    // Bandpass = lowpass + highpass cascade
    const halfOrder = Math.max(1, Math.round(effectiveOrder / 2));
    const low = cutoffHz + (bandwidthHz ?? cutoffHz * 0.5) / 2;
    const high = cutoffHz - (bandwidthHz ?? cutoffHz * 0.5) / 2;
    const lpSections = designButterworth('lowpass', halfOrder, sampleRate, low);
    const hpSections = designButterworth('highpass', halfOrder, sampleRate, Math.max(high, 1));
    return [...lpSections, ...hpSections];
  }

  // Number of biquad sections for Nth-order
  const numSections = Math.floor(effectiveOrder / 2);
  const hasFirstOrder = effectiveOrder % 2 === 1;

  for (let k = 0; k < numSections; k++) {
    const qk = 1 / (2 * Math.cos(Math.PI * (2 * k + 1) / (2 * effectiveOrder)));
    sections.push(designBiquad(type, sampleRate, cutoffHz, qk));
  }

  if (hasFirstOrder) {
    // First-order section as biquad with b2=a2=0
    const omega = (2 * Math.PI * cutoffHz) / sampleRate;
    const cos = Math.cos(omega);
    const sin = Math.sin(omega);
    if (type === 'lowpass') {
      const a0 = sin + 1 + cos;
      sections.push({
        b0: sin / a0,
        b1: sin / a0,
        b2: 0,
        a1: (sin - 1 - cos) / a0,
        a2: 0,
      });
    } else {
      const a0 = sin + 1 + cos;
      sections.push({
        b0: (1 + cos) / a0,
        b1: -(1 + cos) / a0,
        b2: 0,
        a1: (sin - 1 - cos) / a0,
        a2: 0,
      });
    }
  }

  return sections;
}

/**
 * Apply cascaded biquad filter sections to a signal.
 */
export function applyCascadedFilter(
  input: Float32Array,
  sections: BiquadCoefficients[]
): Float32Array {
  let signal = input;
  for (const sec of sections) {
    signal = applyBiquadOnce(signal, sec);
  }
  return signal;
}

/**
 * Apply a Butterworth filter of given order.
 */
export function applyButterworthFilter(
  input: Float32Array,
  sampleRate: number,
  type: 'lowpass' | 'highpass' | 'bandpass',
  order: number,
  cutoffHz: number,
  bandwidthHz?: number
): Float32Array {
  const sections = designButterworth(type, order, sampleRate, cutoffHz, bandwidthHz);
  return applyCascadedFilter(input, sections);
}

// ─── FFT-domain filtering (gain curve) ──────────────────────────────────────

function nextPowerOfTwo(n: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, n)));
}

/**
 * Inverse FFT (in-place). Conjugate → FFT → conjugate → scale.
 */
export function ifftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Conjugate
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fftInPlace(re, im);
  // Conjugate and scale
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] = -im[i] / n;
  }
}

/**
 * Full FFT returning complex arrays (real + imag), zero-padded to fftSize.
 */
export function fftComplex(signal: Float64Array, fftSize: number): { re: Float64Array; im: Float64Array } {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  for (let i = 0; i < Math.min(signal.length, fftSize); i++) {
    re[i] = signal[i];
  }
  fftInPlace(re, im);
  return { re, im };
}

/**
 * Apply a gain curve in the frequency domain and return the filtered time-domain signal.
 * @param input - time-domain signal (Float32Array)
 * @param gainCurve - gain values for each FFT bin (0..fftSize/2), in linear scale
 * @returns filtered signal of the same length as input
 */
export function applyGainCurveFilter(
  input: Float32Array,
  gainCurve: Float64Array
): Float32Array {
  const fftSize = nextPowerOfTwo(input.length);
  const bins = fftSize / 2 + 1;

  // FFT
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  for (let i = 0; i < input.length; i++) re[i] = input[i];
  fftInPlace(re, im);

  // Apply gain (symmetric for real signal)
  for (let i = 0; i < bins; i++) {
    const g = i < gainCurve.length ? gainCurve[i] : (gainCurve.length > 0 ? gainCurve[gainCurve.length - 1] : 1);
    re[i] *= g;
    im[i] *= g;
    if (i > 0 && i < fftSize - i) {
      re[fftSize - i] *= g;
      im[fftSize - i] *= g;
    }
  }

  // IFFT
  ifftInPlace(re, im);

  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) output[i] = re[i];
  return output;
}

/**
 * Compute the frequency response (magnitude) of a biquad filter at given frequencies.
 * Returns gain in linear scale for each frequency bin.
 */
export function biquadFrequencyResponse(
  coeffs: BiquadCoefficients,
  numBins: number,
  sampleRate: number
): Float64Array {
  const response = new Float64Array(numBins);
  for (let i = 0; i < numBins; i++) {
    const omega = (Math.PI * i) / Math.max(numBins - 1, 1);
    const cosW = Math.cos(omega);
    const cos2W = Math.cos(2 * omega);
    const sinW = Math.sin(omega);
    const sin2W = Math.sin(2 * omega);

    const numRe = coeffs.b0 + coeffs.b1 * cosW + coeffs.b2 * cos2W;
    const numIm = -(coeffs.b1 * sinW + coeffs.b2 * sin2W);
    const denRe = 1 + coeffs.a1 * cosW + coeffs.a2 * cos2W;
    const denIm = -(coeffs.a1 * sinW + coeffs.a2 * sin2W);

    const numMag = Math.hypot(numRe, numIm);
    const denMag = Math.hypot(denRe, denIm);
    response[i] = numMag / Math.max(denMag, 1e-10);
  }
  return response;
}

/**
 * Compute cascaded frequency response for multiple biquad sections.
 */
export function cascadedFrequencyResponse(
  sections: BiquadCoefficients[],
  numBins: number,
  sampleRate: number
): Float64Array {
  const response = new Float64Array(numBins).fill(1);
  for (const sec of sections) {
    const secResponse = biquadFrequencyResponse(sec, numBins, sampleRate);
    for (let i = 0; i < numBins; i++) {
      response[i] *= secResponse[i];
    }
  }
  return response;
}

/**
 * Generate a gain curve from filter preset settings.
 * Returns linear gain per bin.
 */
export function presetToGainCurve(
  type: FilterType,
  numBins: number,
  sampleRate: number,
  cutoffHz: number,
  q: number,
  order = 2
): Float64Array {
  if (type === 'none') {
    return new Float64Array(numBins).fill(1);
  }
  if (order <= 2) {
    const coeffs = designBiquad(type as Exclude<FilterType, 'none'>, sampleRate, cutoffHz, q);
    return biquadFrequencyResponse(coeffs, numBins, sampleRate);
  }
  // Higher-order Butterworth
  const bwType = type === 'notch' ? 'bandpass' : type as 'lowpass' | 'highpass' | 'bandpass';
  const sections = designButterworth(bwType, order, sampleRate, cutoffHz);
  const response = cascadedFrequencyResponse(sections, numBins, sampleRate);
  // Invert for notch
  if (type === 'notch') {
    for (let i = 0; i < numBins; i++) {
      response[i] = 1 / Math.max(response[i], 1e-10);
      // Clamp to reasonable range
      response[i] = Math.min(response[i], 100);
    }
  }
  return response;
}
