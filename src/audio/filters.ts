import type { FilterSettings, FilterType } from '../types';

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

  return normalizeCoefficients(
    alpha,
    0,
    -alpha,
    1 + alpha,
    -2 * cos,
    1 - alpha
  );
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
  const output = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 =
      coeffs.b0 * x0 +
      coeffs.b1 * x1 +
      coeffs.b2 * x2 -
      coeffs.a1 * y1 -
      coeffs.a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
}
