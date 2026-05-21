/**
 * LPC analysis using Burg's method.
 */

const DEFAULT_MAX_FORMANT = 5500;
const PRE_EMPHASIS_FROM = 50;

function downsample(signal: Float64Array, factor: number): Float64Array {
  if (factor <= 1) return Float64Array.from(signal);
  // Anti-aliasing: simple moving-average low-pass before decimation
  // (Praat uses sinc interpolation via Sound_resample, but averaging is
  // a reasonable approximation for LPC formant extraction)
  const filtered = new Float64Array(signal.length);
  const halfWin = Math.floor(factor / 2);
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - halfWin); j <= Math.min(signal.length - 1, i + halfWin); j++) {
      sum += signal[j];
      count++;
    }
    filtered[i] = sum / count;
  }
  // Decimate
  const outLen = Math.floor(signal.length / factor);
  const out = new Float64Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = filtered[i * factor];
  }
  return out;
}

function preEmphasis(signal: Float64Array, sampleRate: number, fromHz = PRE_EMPHASIS_FROM): Float64Array {
  const alpha = Math.exp(-2 * Math.PI * fromHz / sampleRate);
  const out = new Float64Array(signal.length);
  out[0] = signal[0];
  for (let i = 1; i < signal.length; i++) {
    out[i] = signal[i] - alpha * signal[i - 1];
  }
  return out;
}

function gaussianWindow(signal: Float64Array): Float64Array {
  const size = signal.length;
  const out = new Float64Array(size);
  // Praat uses a Gaussian with effective duration = windowLength/2
  // sigma such that at edges the window ≈ exp(-12) ≈ 0
  const midpoint = (size - 1) / 2;
  const sigma = midpoint / 3.5; // approx Praat's Gaussian shape
  for (let i = 0; i < size; i++) {
    const x = (i - midpoint) / sigma;
    out[i] = signal[i] * Math.exp(-0.5 * x * x);
  }
  return out;
}

export function burgMethod(signal: Float64Array, order: number): Float64Array {
  const length = signal.length;
  const coefficients = new Float64Array(order + 1);
  let forward = Float64Array.from(signal);
  let backward = Float64Array.from(signal);

  for (let k = 1; k <= order; k++) {
    let numerator = 0;
    let denominator = 0;
    for (let n = k; n < length; n++) {
      numerator += forward[n] * backward[n - 1];
      denominator += forward[n] * forward[n] + backward[n - 1] * backward[n - 1];
    }
    const reflection = denominator > 1e-30 ? (-2 * numerator) / denominator : 0;
    coefficients[k] = reflection;
    const previous = Float64Array.from(coefficients);
    for (let j = 1; j < k; j++) {
      coefficients[j] = previous[j] + reflection * previous[k - j];
    }

    const nextForward = new Float64Array(length);
    const nextBackward = new Float64Array(length);
    for (let n = k; n < length; n++) {
      nextForward[n] = forward[n] + reflection * backward[n - 1];
      nextBackward[n] = backward[n - 1] + reflection * forward[n];
    }
    forward = nextForward;
    backward = nextBackward;
  }

  for (let i = 1; i <= order; i++) {
    coefficients[i] = -coefficients[i];
  }
  return coefficients;
}

function findRoots(coefficients: Float64Array, order: number): Array<{ re: number; im: number }> {
  const polynomial = new Float64Array(order + 1);
  polynomial[0] = 1;
  for (let i = 1; i <= order; i++) {
    polynomial[i] = -coefficients[i];
  }

  const roots: Array<{ re: number; im: number }> = [];
  for (let i = 0; i < order; i++) {
    const angle = (2 * Math.PI * i) / order + 0.01;
    const radius = 0.9 + 0.05 * (i / order);
    roots.push({ re: radius * Math.cos(angle), im: radius * Math.sin(angle) });
  }

  for (let iteration = 0; iteration < 100; iteration++) {
    let maxDelta = 0;
    for (let i = 0; i < order; i++) {
      let pRe = 1;
      let pIm = 0;
      for (let k = 1; k <= order; k++) {
        const nextRe = pRe * roots[i].re - pIm * roots[i].im;
        const nextIm = pRe * roots[i].im + pIm * roots[i].re;
        pRe = nextRe + polynomial[k];
        pIm = nextIm;
      }

      let dRe = 1;
      let dIm = 0;
      for (let j = 0; j < order; j++) {
        if (j === i) continue;
        const diffRe = roots[i].re - roots[j].re;
        const diffIm = roots[i].im - roots[j].im;
        const nextRe = dRe * diffRe - dIm * diffIm;
        const nextIm = dRe * diffIm + dIm * diffRe;
        dRe = nextRe;
        dIm = nextIm;
      }

      const denom = dRe * dRe + dIm * dIm;
      if (denom < 1e-30) continue;
      const deltaRe = (pRe * dRe + pIm * dIm) / denom;
      const deltaIm = (pIm * dRe - pRe * dIm) / denom;
      roots[i].re -= deltaRe;
      roots[i].im -= deltaIm;
      maxDelta = Math.max(maxDelta, Math.hypot(deltaRe, deltaIm));
    }
    if (maxDelta < 1e-10) break;
  }

  return roots;
}

function prepareFrame(frame: Float64Array, sampleRate: number, maxFrequency = DEFAULT_MAX_FORMANT): { windowed: Float64Array; effectiveRate: number } | null {
  const targetRate = 2 * maxFrequency; // Praat downsamples to 2*maxFormant
  const factor = Math.max(1, Math.round(sampleRate / targetRate));
  const effectiveRate = factor > 1 ? sampleRate / factor : sampleRate;
  const downsampled = downsample(frame, factor);
  if (downsampled.length < 4) return null;

  let energy = 0;
  for (let i = 0; i < downsampled.length; i++) energy += downsampled[i] * downsampled[i];
  // Skip only completely silent frames
  if (energy === 0) return null;

  const emphasized = preEmphasis(downsampled, effectiveRate);
  return {
    windowed: gaussianWindow(emphasized),
    effectiveRate,
  };
}

interface FormantCandidate {
  freq: number;
  bandwidth: number;
}

export interface FormantResult {
  f1: number;
  f2: number;
  f3: number | null;
  candidates: FormantCandidate[];
}

function extractFormantCandidates(
  frame: Float64Array,
  sampleRate: number,
  lpcOrder = 10,
  maxFrequency = DEFAULT_MAX_FORMANT
): FormantCandidate[] {
  const prepared = prepareFrame(frame, sampleRate, maxFrequency);
  if (!prepared || prepared.windowed.length < lpcOrder + 1) return [];

  const coefficients = burgMethod(prepared.windowed, lpcOrder);
  const roots = findRoots(coefficients, lpcOrder);
  const candidates: FormantCandidate[] = [];
  const safetyMargin = 50; // Hz, same as Praat
  const nyquist = prepared.effectiveRate / 2;

  for (const root of roots) {
    if (root.im <= 0) continue;
    // Praat: Roots_fixIntoUnitCircle — push roots inside unit circle
    const magnitude = Math.hypot(root.re, root.im);
    const fixedMag = magnitude > 1.0 ? 1.0 / magnitude : magnitude;
    const angle = Math.atan2(root.im, root.re);
    const frequency = Math.abs(angle) * nyquist / Math.PI;
    const bandwidth = -Math.log(fixedMag) * prepared.effectiveRate / Math.PI;
    // Praat only filters by frequency range, not magnitude or bandwidth
    if (frequency >= safetyMargin && frequency <= nyquist - safetyMargin) {
      candidates.push({ freq: frequency, bandwidth });
    }
  }

  return candidates.sort((a, b) => a.freq - b.freq);
}

export function extractFormants(
  frame: Float64Array,
  sampleRate: number,
  lpcOrder = 10,
  maxFrequency = DEFAULT_MAX_FORMANT
): FormantResult | null {
  const candidates = extractFormantCandidates(frame, sampleRate, lpcOrder, maxFrequency);
  if (candidates.length < 2) return null;

  // Take first 3 candidates sorted by frequency as F1/F2/F3
  const f1 = candidates[0]?.freq ?? null;
  const f2 = candidates[1]?.freq ?? null;
  const f3 = candidates[2]?.freq ?? null;

  if (f1 === null || f2 === null) return null;
  return { f1, f2, f3, candidates };
}
