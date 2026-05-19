/**
 * F1/F2 → IPA vowel mapping using Bark scale distance.
 *
 * This module provides the core mapping logic for automatic IPA annotation.
 * Uses perceptually-motivated Bark scale for distance calculations.
 */

export interface VowelTarget {
  ipa: string;
  f1: number;
  f2: number;
}

/**
 * Standard IPA vowel space coordinates (Hz).
 * Based on Hillenbrand et al. (1995) and IPA handbook norms.
 */
export const vowelTargets: VowelTarget[] = [
  { ipa: 'i', f1: 300, f2: 2300 },
  { ipa: 'ɪ', f1: 400, f2: 2000 },
  { ipa: 'e', f1: 400, f2: 2100 },
  { ipa: 'ɛ', f1: 550, f2: 1800 },
  { ipa: 'æ', f1: 700, f2: 1700 },
  { ipa: 'a', f1: 700, f2: 1200 },
  { ipa: 'ɑ', f1: 700, f2: 1200 },
  { ipa: 'ɔ', f1: 600, f2: 900 },
  { ipa: 'o', f1: 450, f2: 800 },
  { ipa: 'ʊ', f1: 400, f2: 1000 },
  { ipa: 'u', f1: 300, f2: 800 },
  { ipa: 'ə', f1: 500, f2: 1500 },
  { ipa: 'ʌ', f1: 600, f2: 1200 },
];

/**
 * Convert frequency in Hz to Bark scale.
 * Bark scale better models human auditory perception.
 */
export function hzToBark(hz: number): number {
  return 26.81 / (1 + 1960 / hz) - 0.53;
}

/**
 * Compute perceptual distance between two F1/F2 points using Bark scale.
 */
export function barkDistance(f1a: number, f2a: number, f1b: number, f2b: number): number {
  const b1a = hzToBark(f1a);
  const b2a = hzToBark(f2a);
  const b1b = hzToBark(f1b);
  const b2b = hzToBark(f2b);
  return Math.sqrt((b1a - b1b) ** 2 + (b2a - b2b) ** 2);
}

/**
 * Find the closest IPA vowel for given F1/F2 values.
 * Uses Bark scale distance for perceptually accurate matching.
 */
export function findClosestVowel(f1: number, f2: number): { ipa: string; distance: number } {
  let minDist = Infinity;
  let bestIpa = '?';

  for (const target of vowelTargets) {
    const dist = barkDistance(f1, f2, target.f1, target.f2);
    if (dist < minDist) {
      minDist = dist;
      bestIpa = target.ipa;
    }
  }

  return { ipa: bestIpa, distance: minDist };
}
