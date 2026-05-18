/**
 * LPC analysis using Burg's method.
 * Ported from ~/clawspace/formants/lpc.js to TypeScript.
 */

const INTERNAL_SAMPLE_RATE = 11025;

/**
 * Downsample by integer factor with box anti-aliasing filter.
 */
function downsample(signal: Float64Array, factor: number): Float64Array {
  if (factor <= 1) return Float64Array.from(signal);
  const outLen = Math.floor(signal.length / factor);
  const out = new Float64Array(outLen);
  for (let i = 0; i < outLen; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) {
      sum += signal[i * factor + j];
    }
    out[i] = sum / factor;
  }
  return out;
}

/**
 * Pre-emphasis filter: y[n] = x[n] - α * x[n-1]
 */
function preEmphasis(signal: Float64Array, alpha = 0.97): Float64Array {
  const out = new Float64Array(signal.length);
  out[0] = signal[0];
  for (let i = 1; i < signal.length; i++) {
    out[i] = signal[i] - alpha * signal[i - 1];
  }
  return out;
}

/**
 * Hamming window.
 */
function hammingWindow(signal: Float64Array): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = signal[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return out;
}

/**
 * Burg's method for LPC coefficient estimation.
 */
export function burgMethod(signal: Float64Array, order: number): Float64Array {
  const N = signal.length;
  const a = new Float64Array(order + 1);
  let ef = Float64Array.from(signal);
  let eb = Float64Array.from(signal);

  for (let k = 1; k <= order; k++) {
    let num = 0;
    let den = 0;
    for (let n = k; n < N; n++) {
      num += ef[n] * eb[n - 1];
      den += ef[n] * ef[n] + eb[n - 1] * eb[n - 1];
    }
    const km = den > 1e-30 ? (-2 * num) / den : 0;

    a[k] = km;
    const aOld = Float64Array.from(a);
    for (let j = 1; j < k; j++) {
      a[j] = aOld[j] + km * aOld[k - j];
    }

    const efNew = new Float64Array(N);
    const ebNew = new Float64Array(N);
    for (let n = k; n < N; n++) {
      efNew[n] = ef[n] + km * eb[n - 1];
      ebNew[n] = eb[n - 1] + km * ef[n];
    }
    ef = efNew;
    eb = ebNew;
  }

  // Negate to prediction form
  for (let i = 1; i <= order; i++) {
    a[i] = -a[i];
  }
  return a;
}

/**
 * Find roots of LPC polynomial using Durand-Kerner method.
 */
function findRoots(a: Float64Array, order: number): Array<{ re: number; im: number }> {
  const coeffs = new Float64Array(order + 1);
  coeffs[0] = 1;
  for (let i = 1; i <= order; i++) {
    coeffs[i] = -a[i];
  }

  const roots: Array<{ re: number; im: number }> = [];
  for (let i = 0; i < order; i++) {
    const angle = (2 * Math.PI * i) / order + 0.01;
    const r = 0.9 + 0.05 * (i / order);
    roots.push({ re: r * Math.cos(angle), im: r * Math.sin(angle) });
  }

  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < order; i++) {
      let pRe = 1;
      let pIm = 0;
      for (let k = 1; k <= order; k++) {
        const newRe = pRe * roots[i].re - pIm * roots[i].im;
        const newIm = pRe * roots[i].im + pIm * roots[i].re;
        pRe = newRe + coeffs[k];
        pIm = newIm;
      }

      let dRe = 1;
      let dIm = 0;
      for (let j = 0; j < order; j++) {
        if (j === i) continue;
        const diffRe = roots[i].re - roots[j].re;
        const diffIm = roots[i].im - roots[j].im;
        const newDRe = dRe * diffRe - dIm * diffIm;
        const newDIm = dRe * diffIm + dIm * diffRe;
        dRe = newDRe;
        dIm = newDIm;
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

interface PreparedFrame {
  windowed: Float64Array;
  effectiveRate: number;
}

function prepareFrame(frame: Float64Array, sampleRate: number): PreparedFrame | null {
  const factor = Math.max(1, Math.round(sampleRate / INTERNAL_SAMPLE_RATE));
  const effectiveRate = factor > 1 ? sampleRate / factor : sampleRate;
  const ds = downsample(frame, factor);

  let energy = 0;
  for (let i = 0; i < ds.length; i++) energy += ds[i] * ds[i];
  if (energy / ds.length < 1e-8) return null;

  const emphasized = preEmphasis(ds);
  const windowed = hammingWindow(emphasized);
  return { windowed, effectiveRate };
}

export interface FormantResult {
  f1: number;
  f2: number;
  f3: number | null;
}

/**
 * Extract formant frequencies from an audio frame.
 */
export function extractFormants(
  frame: Float64Array,
  sampleRate: number,
  lpcOrder = 12
): FormantResult | null {
  const prep = prepareFrame(frame, sampleRate);
  if (!prep) return null;
  if (prep.windowed.length < lpcOrder + 1) return null;

  const { windowed, effectiveRate } = prep;
  const a = burgMethod(windowed, lpcOrder);
  const roots = findRoots(a, lpcOrder);

  const formants: Array<{ freq: number; bandwidth: number }> = [];
  for (const root of roots) {
    if (root.im < 0) continue;
    const mag = Math.hypot(root.re, root.im);
    if (mag < 0.3 || mag > 1.0) continue;
    const angle = Math.atan2(root.im, root.re);
    const freq = (angle * effectiveRate) / (2 * Math.PI);
    const bandwidth = (-Math.log(mag) * effectiveRate) / Math.PI;
    if (freq > 50 && freq < effectiveRate / 2 && bandwidth < 600) {
      formants.push({ freq, bandwidth });
    }
  }

  formants.sort((a, b) => a.freq - b.freq);
  if (formants.length < 2) return null;

  let f1: number | null = null;
  let f2: number | null = null;
  let f3: number | null = null;
  for (const f of formants) {
    if (f1 === null && f.freq >= 100 && f.freq <= 1200) {
      f1 = f.freq;
    } else if (f1 !== null && f2 === null && f.freq >= 500 && f.freq <= 3500) {
      f2 = f.freq;
    } else if (f2 !== null && f3 === null && f.freq >= 1500 && f.freq <= 4500) {
      f3 = f.freq;
    }
  }

  if (f1 === null || f2 === null) return null;
  return { f1, f2, f3 };
}
