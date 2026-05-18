/**
 * Radix-2 Cooley-Tukey FFT implementation.
 * All algorithms implemented from scratch — no external libraries.
 */

/**
 * Compute FFT of a real-valued signal (zero-padded to fftSize).
 * Returns magnitude spectrum (first fftSize/2 + 1 bins).
 */
export function fftMagnitude(signal: Float64Array, fftSize: number): Float64Array {
  const n = fftSize;
  // Zero-pad or truncate
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < Math.min(signal.length, n); i++) {
    re[i] = signal[i];
  }

  fftInPlace(re, im);

  const bins = n / 2 + 1;
  const mag = new Float64Array(bins);
  for (let i = 0; i < bins; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mag;
}

/**
 * In-place radix-2 FFT. Arrays must be power-of-2 length.
 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly passes
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angleStep = -2 * Math.PI / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k;
        const twRe = Math.cos(angle);
        const twIm = Math.sin(angle);
        const evenIdx = i + k;
        const oddIdx = i + k + halfSize;
        const tRe = twRe * re[oddIdx] - twIm * im[oddIdx];
        const tIm = twRe * im[oddIdx] + twIm * re[oddIdx];
        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] += tRe;
        im[evenIdx] += tIm;
      }
    }
  }
}

/**
 * Apply Hamming window to a signal.
 */
export function hammingWindow(signal: Float64Array): Float64Array {
  const N = signal.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = signal[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return out;
}
