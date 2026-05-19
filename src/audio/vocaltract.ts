/**
 * Vocal Tract area function model.
 * Implements the Kelly-Lochbaum acoustic tube model to compute
 * the transfer function (frequency response) from glottis to lips.
 *
 * Reference: Kelly & Lochbaum (1962), "Speech Synthesis"
 */

/** Speed of sound in cm/s */
const SPEED_OF_SOUND = 35000;

/** Default vocal tract length in cm */
const DEFAULT_TRACT_LENGTH = 17.5;

export interface VocalTractConfig {
  /** Cross-sectional areas from glottis to lips (cm²), typically 17-44 sections */
  areas: number[];
  /** Total tract length in cm (default 17.5) */
  tractLength?: number;
  /** Sample rate for frequency response computation */
  sampleRate?: number;
}

export interface FrequencyResponse {
  /** Frequencies in Hz */
  frequencies: Float64Array;
  /** Magnitude in dB */
  magnitudes: Float64Array;
  /** Phase in radians */
  phases: Float64Array;
}

export interface ComplexNumber {
  re: number;
  im: number;
}

function complexMul(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexAdd(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexMag(c: ComplexNumber): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function complexPhase(c: ComplexNumber): number {
  return Math.atan2(c.im, c.re);
}

/**
 * Compute reflection coefficients from area function.
 * r[i] = (A[i] - A[i+1]) / (A[i] + A[i+1])
 */
export function computeReflectionCoefficients(areas: number[]): Float64Array {
  const n = areas.length - 1;
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const sum = areas[i] + areas[i + 1];
    r[i] = sum === 0 ? 0 : (areas[i] - areas[i + 1]) / sum;
  }
  return r;
}

/**
 * Compute the transfer function of the vocal tract using the
 * Kelly-Lochbaum concatenated tube model.
 *
 * Each section is modeled as a lossless acoustic tube.
 * The transfer matrix for each junction + tube delay is cascaded.
 */
export function computeTransferFunction(
  config: VocalTractConfig,
  numPoints: number = 512
): FrequencyResponse {
  const { areas, tractLength = DEFAULT_TRACT_LENGTH, sampleRate = 44100 } = config;
  const n = areas.length;
  const sectionLength = tractLength / n;
  const delay = sectionLength / SPEED_OF_SOUND; // seconds per section

  const reflections = computeReflectionCoefficients(areas);

  const frequencies = new Float64Array(numPoints);
  const magnitudes = new Float64Array(numPoints);
  const phases = new Float64Array(numPoints);

  const maxFreq = sampleRate / 2;

  for (let k = 0; k < numPoints; k++) {
    const freq = (k * maxFreq) / numPoints;
    frequencies[k] = freq;

    const omega = 2 * Math.PI * freq;
    // Phase shift per section
    const phi = omega * delay;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    // Cascade transfer matrices: T = T_n * T_{n-1} * ... * T_1
    // Each junction matrix M_i = (1/(1-r_i)) * [[1, r_i], [r_i, 1]]
    // Combined with delay: propagation e^{-j*omega*delay}
    // We track the total transfer as product of 2x2 complex matrices
    let t00: ComplexNumber = { re: 1, im: 0 };
    let t01: ComplexNumber = { re: 0, im: 0 };
    let t10: ComplexNumber = { re: 0, im: 0 };
    let t11: ComplexNumber = { re: 1, im: 0 };

    for (let i = 0; i < reflections.length; i++) {
      const r = reflections[i];
      const scale = 1 / (1 - r);

      // Junction scattering matrix (scaled)
      // [[1, r], [r, 1]] * (1/(1-r)) but we use (1+r) for transmission
      // Actually use transfer matrix formulation:
      // T_i = (1/t_i) * [[1, r_i], [r_i, 1]] where t_i = 1 - r_i (forward transmission)
      const m00: ComplexNumber = { re: scale, im: 0 };
      const m01: ComplexNumber = { re: r * scale, im: 0 };
      const m10: ComplexNumber = { re: r * scale, im: 0 };
      const m11: ComplexNumber = { re: scale, im: 0 };

      // Delay matrix for this section: [[e^{-j*phi}, 0], [0, e^{j*phi}]]
      const ejp: ComplexNumber = { re: cosPhi, im: -sinPhi };
      const emjp: ComplexNumber = { re: cosPhi, im: sinPhi };

      // Combined: delay * junction
      const d00 = complexMul(ejp, m00);
      const d01 = complexMul(ejp, m01);
      const d10 = complexMul(emjp, m10);
      const d11 = complexMul(emjp, m11);

      // Cascade: T_new = D * T_old
      const new00 = complexAdd(complexMul(d00, t00), complexMul(d01, t10));
      const new01 = complexAdd(complexMul(d00, t01), complexMul(d01, t11));
      const new10 = complexAdd(complexMul(d10, t00), complexMul(d11, t10));
      const new11 = complexAdd(complexMul(d10, t01), complexMul(d11, t11));

      t00 = new00;
      t01 = new01;
      t10 = new10;
      t11 = new11;
    }

    // Transfer function H(f) = 1 / T[0][0]
    // (ratio of output pressure to input volume velocity)
    const mag = complexMag(t00);
    const magDb = mag > 0 ? -20 * Math.log10(mag) : -100;
    magnitudes[k] = magDb;
    phases[k] = -complexPhase(t00);
  }

  return { frequencies, magnitudes, phases };
}

/**
 * Estimate vocal tract areas from formant frequencies.
 * Uses a simplified inverse mapping based on perturbation theory.
 *
 * This is an approximation — the inverse problem is ill-posed,
 * but we use the Schroeder (1967) approach for a reasonable estimate.
 *
 * @param formants - Formant frequencies in Hz (F1, F2, F3, ...)
 * @param numSections - Number of tube sections (default 17)
 * @param tractLength - Tract length in cm (default 17.5)
 * @returns Estimated cross-sectional areas
 */
export function estimateAreasFromFormants(
  formants: number[],
  numSections: number = 17,
  tractLength: number = DEFAULT_TRACT_LENGTH
): Float64Array {
  const areas = new Float64Array(numSections);
  const sectionLength = tractLength / numSections;

  // Start with uniform tube (neutral vowel /ə/)
  const neutralArea = 5.0; // cm²
  areas.fill(neutralArea);

  // Apply perturbation for each formant
  // Based on standing wave patterns in the vocal tract:
  // Constriction near a velocity maximum raises the formant
  // Constriction near a pressure maximum lowers the formant
  for (let f = 0; f < formants.length && f < 5; f++) {
    const formantFreq = formants[f];
    // Expected formant for uniform tube: (2n-1) * c / (4L)
    const expectedFreq = ((2 * (f + 1) - 1) * SPEED_OF_SOUND) / (4 * tractLength);
    const ratio = formantFreq / expectedFreq;

    // Perturbation: modify areas at standing wave nodes/antinodes
    for (let i = 0; i < numSections; i++) {
      const x = (i + 0.5) * sectionLength; // position along tract
      // Sensitivity function for formant f at position x
      // cos(2*pi*f_n*x / c) gives pressure standing wave pattern
      const sensitivity = Math.cos(
        (2 * Math.PI * (f + 1) * x) / (2 * tractLength)
      );
      // If ratio > 1, formant is higher than neutral → widen at velocity max
      const perturbation = (ratio - 1) * sensitivity * 0.5;
      areas[i] *= 1 + perturbation;
    }
  }

  // Clamp areas to physically reasonable range (0.3 - 20 cm²)
  for (let i = 0; i < numSections; i++) {
    areas[i] = Math.max(0.3, Math.min(20, areas[i]));
  }

  return areas;
}

/**
 * Generate a default vocal tract shape for common vowels.
 */
export function getVowelTract(vowel: string, numSections: number = 17): Float64Array {
  // Approximate formant values for common vowels
  const vowelFormants: Record<string, number[]> = {
    'a': [800, 1200, 2500],   // open front /a/
    'i': [270, 2300, 3000],   // close front /i/
    'u': [300, 870, 2250],    // close back /u/
    'e': [400, 2000, 2550],   // close-mid front /e/
    'o': [500, 900, 2500],    // close-mid back /o/
    'ə': [500, 1500, 2500],   // schwa (neutral)
  };

  const formants = vowelFormants[vowel] || vowelFormants['ə'];
  return estimateAreasFromFormants(formants, numSections);
}

/**
 * Find formant frequencies from the transfer function peaks.
 */
export function findFormants(response: FrequencyResponse, maxFormants: number = 5): number[] {
  const formants: number[] = [];
  const { frequencies, magnitudes } = response;

  for (let i = 1; i < magnitudes.length - 1 && formants.length < maxFormants; i++) {
    if (
      magnitudes[i] > magnitudes[i - 1] &&
      magnitudes[i] > magnitudes[i + 1] &&
      frequencies[i] > 90 && // ignore very low frequencies
      frequencies[i] < 5500
    ) {
      formants.push(frequencies[i]);
    }
  }

  return formants;
}
