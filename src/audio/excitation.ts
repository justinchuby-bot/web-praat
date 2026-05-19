/**
 * Excitation pattern — auditory excitation pattern visualization.
 *
 * Converts a spectrum to an excitation pattern (in phon) by:
 * 1. Computing power in Bark-spaced frequency bands
 * 2. Convolving with an auditory masking filter
 * 3. Converting to phon (sound pressure level corrected for frequency)
 *
 * Based on Praat's Spectrum_to_Excitation algorithm (Paul Boersma).
 */

/** Convert Hz to Bark scale (Praat formula) */
export function hertzToBark(hertz: number): number {
  if (hertz < 0) return NaN;
  const r = hertz / 650.0;
  return 7.0 * Math.log(r + Math.sqrt(1.0 + r * r));
}

/** Convert Bark to Hz */
export function barkToHertz(bark: number): number {
  if (bark < 0) return NaN;
  return 650.0 * Math.sinh(bark / 7.0);
}

/**
 * Convert sound pressure (Pa) to phon, accounting for frequency (Bark).
 * Praat's NUMsoundPressureToPhon.
 */
export function soundPressureToPhon(soundPressure: number, bark: number): number {
  if (soundPressure <= 0 || bark < 0) return 0;

  // dB SPL
  let result = 20.0 * Math.log10(soundPressure / 2.0e-5);

  // Low-level correction at low frequencies
  if (result < 90.0 && bark < 8.0) {
    result -= ((90.0 - result) * (8.0 - bark)) ** 2 / 2500.0;
  }

  // Mid-frequency boost
  result += 5.0 * Math.exp(-((bark / 3.6 - 5.0) ** 2));

  // High-frequency rolloff
  if (bark > 20.0) {
    result -= 0.5 * (bark - 20.0) ** 2;
  }

  return Math.max(0, result);
}

export interface ExcitationResult {
  /** Excitation values in phon, one per Bark bin */
  values: Float64Array;
  /** Number of Bark bins */
  numBins: number;
  /** Bark step size */
  dBark: number;
  /** Loudness in sones */
  loudness: number;
}

/**
 * Compute excitation pattern from a magnitude spectrum.
 *
 * @param magnitudes - FFT magnitude spectrum (linear, not dB)
 * @param sampleRate - Sample rate in Hz
 * @param dBark - Bark resolution (default 0.1 Bark)
 */
export function computeExcitation(
  magnitudes: Float64Array | Float32Array,
  sampleRate: number,
  dBark: number = 0.1,
): ExcitationResult {
  const nFreqBins = magnitudes.length;
  const df = (sampleRate / 2) / nFreqBins; // frequency resolution per bin
  const nbark = Math.round(25.6 / dBark);

  // Build auditory (masking) filter
  const auditoryFilter = new Float64Array(nbark);
  for (let i = 0; i < nbark; i++) {
    const bark = dBark * (i - nbark / 2) + 0.474;
    auditoryFilter[i] = Math.pow(10, 1.581 + 0.75 * bark - 1.75 * Math.sqrt(1 + bark * bark));
  }

  // Compute Bark-band edge frequencies and corresponding FFT bin indices
  const iFreqs = new Int32Array(nbark + 1);
  const rFreqs = new Float64Array(nbark + 1);
  for (let i = 0; i <= nbark; i++) {
    rFreqs[i] = barkToHertz(dBark * i);
    iFreqs[i] = Math.round(rFreqs[i] / df);
  }

  // Accumulate power in each Bark band
  const inSig = new Float64Array(nbark);
  for (let i = 0; i < nbark; i++) {
    const low = Math.max(0, iFreqs[i]);
    const high = Math.min(iFreqs[i + 1] - 1, nFreqBins - 1);
    for (let j = low; j <= high; j++) {
      inSig[i] += magnitudes[j] * magnitudes[j]; // power
    }
    // Anti-undersampling correction
    if (high >= low) {
      inSig[i] *= 2.0 * (rFreqs[i + 1] - rFreqs[i]) / (high - low + 1) * (1.0 / sampleRate);
    }
  }

  // Convolution with auditory filter
  const outSig = new Float64Array(2 * nbark);
  for (let i = 0; i < nbark; i++) {
    for (let j = 0; j < nbark; j++) {
      outSig[i + j] += inSig[i] * auditoryFilter[j];
    }
  }

  // Convert to phon
  const values = new Float64Array(nbark);
  const halfNbark = Math.floor(nbark / 2);
  for (let i = 0; i < nbark; i++) {
    const barkCenter = dBark * (i + 0.5); // center of bin in Bark
    values[i] = soundPressureToPhon(Math.sqrt(outSig[i + halfNbark]), barkCenter);
  }

  // Compute loudness (sones)
  let loudness = 0;
  for (let i = 0; i < nbark; i++) {
    loudness += Math.pow(2, (values[i] - 40) / 10);
  }
  loudness *= dBark;

  return { values, numBins: nbark, dBark, loudness };
}

/**
 * Compute excitation pattern directly from audio samples.
 * Uses a full-signal FFT (or a windowed segment).
 */
export function computeExcitationFromSignal(
  samples: Float32Array | Float64Array,
  sampleRate: number,
  dBark: number = 0.1,
): ExcitationResult {
  // Compute FFT magnitude spectrum
  const n = samples.length;
  // Use a simple DFT for the positive frequencies
  const nfft = nextPow2(n);
  const real = new Float64Array(nfft);
  const imag = new Float64Array(nfft);
  for (let i = 0; i < n; i++) {
    real[i] = samples[i];
  }
  fft(real, imag);

  // Magnitude of positive frequencies
  const nPositive = Math.floor(nfft / 2) + 1;
  const magnitudes = new Float64Array(nPositive);
  for (let i = 0; i < nPositive; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }

  // Scale: multiply by dt (1/sampleRate) to get Pa·s units like Praat
  const dt = 1.0 / sampleRate;
  for (let i = 0; i < nPositive; i++) {
    magnitudes[i] *= dt;
  }

  return computeExcitation(magnitudes, sampleRate, dBark);
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place Cooley-Tukey FFT */
function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  // Bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  // FFT
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = -2 * Math.PI / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curReal = 1, curImag = 0;
      for (let j = 0; j < halfLen; j++) {
        const tReal = curReal * real[i + j + halfLen] - curImag * imag[i + j + halfLen];
        const tImag = curReal * imag[i + j + halfLen] + curImag * real[i + j + halfLen];
        real[i + j + halfLen] = real[i + j] - tReal;
        imag[i + j + halfLen] = imag[i + j] - tImag;
        real[i + j] += tReal;
        imag[i + j] += tImag;
        const newReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = newReal;
      }
    }
  }
}
