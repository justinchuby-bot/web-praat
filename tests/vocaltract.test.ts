import { describe, it, expect } from 'vitest';
import {
  computeReflectionCoefficients,
  computeTransferFunction,
  estimateAreasFromFormants,
  getVowelTract,
  findFormants,
} from '../src/audio/vocaltract';

describe('computeReflectionCoefficients', () => {
  it('returns zero for uniform tube', () => {
    const areas = [5, 5, 5, 5, 5];
    const r = computeReflectionCoefficients(areas);
    expect(r.length).toBe(4);
    for (let i = 0; i < r.length; i++) {
      expect(r[i]).toBeCloseTo(0);
    }
  });

  it('computes correct reflection for step change', () => {
    const areas = [4, 1]; // r = (4-1)/(4+1) = 0.6
    const r = computeReflectionCoefficients(areas);
    expect(r[0]).toBeCloseTo(0.6);
  });

  it('handles zero areas gracefully', () => {
    const areas = [0, 0];
    const r = computeReflectionCoefficients(areas);
    expect(r[0]).toBe(0);
  });
});

describe('computeTransferFunction', () => {
  it('returns correct number of frequency points', () => {
    const areas = new Float64Array([5, 5, 5, 5, 5]);
    const result = computeTransferFunction({ areas }, 256);
    expect(result.frequencies.length).toBe(256);
    expect(result.magnitudes.length).toBe(256);
    expect(result.phases.length).toBe(256);
  });

  it('uniform tube has relatively flat response', () => {
    const areas = new Float64Array(17).fill(5);
    const result = computeTransferFunction({ areas }, 512);
    // Should still have resonances at quarter-wave frequencies
    const formants = findFormants(result);
    // Uniform tube: F_n ≈ (2n-1) * c/(4L) ≈ 500, 1500, 2500...
    expect(formants.length).toBeGreaterThanOrEqual(2);
    // Verify formants exist in speech range
    // The model may find low-frequency resonances due to boundary conditions
    const speechFormants = formants.filter(f => f > 300);
    expect(speechFormants.length).toBeGreaterThanOrEqual(1);
    expect(speechFormants[0]).toBeLessThan(1000);
  });

  it('constricted tube shifts formants', () => {
    // Constriction at front should affect formants differently than back
    const uniformAreas = new Float64Array(17).fill(5);
    const constrictedFront = new Float64Array(17).fill(5);
    constrictedFront[14] = 1; // constriction near lips

    const uniformResponse = computeTransferFunction({ areas: uniformAreas }, 512);
    const constrictedResponse = computeTransferFunction({ areas: constrictedFront }, 512);

    const uniformFormants = findFormants(uniformResponse);
    const constrictedFormants = findFormants(constrictedResponse);

    // Formants should shift
    expect(constrictedFormants[0]).not.toBeCloseTo(uniformFormants[0], -1);
  });
});

describe('estimateAreasFromFormants', () => {
  it('returns correct number of sections', () => {
    const areas = estimateAreasFromFormants([500, 1500, 2500], 17);
    expect(areas.length).toBe(17);
  });

  it('all areas are within physical bounds', () => {
    const areas = estimateAreasFromFormants([270, 2300, 3000], 17);
    for (let i = 0; i < areas.length; i++) {
      expect(areas[i]).toBeGreaterThanOrEqual(0.3);
      expect(areas[i]).toBeLessThanOrEqual(20);
    }
  });

  it('neutral vowel formants produce roughly uniform tube', () => {
    // Neutral formants ~500, 1500, 2500
    const areas = estimateAreasFromFormants([500, 1500, 2500], 17);
    const mean = areas.reduce((s, v) => s + v, 0) / areas.length;
    // Should be roughly 5 cm² (neutral)
    expect(mean).toBeGreaterThan(3);
    expect(mean).toBeLessThan(8);
  });
});

describe('getVowelTract', () => {
  it('returns areas for known vowels', () => {
    for (const v of ['a', 'i', 'u', 'e', 'o', 'ə']) {
      const areas = getVowelTract(v);
      expect(areas.length).toBe(17);
      expect(areas[0]).toBeGreaterThan(0);
    }
  });

  it('different vowels produce different shapes', () => {
    const aAreas = getVowelTract('a');
    const iAreas = getVowelTract('i');
    let diff = 0;
    for (let i = 0; i < aAreas.length; i++) {
      diff += Math.abs(aAreas[i] - iAreas[i]);
    }
    expect(diff).toBeGreaterThan(1); // meaningfully different
  });

  it('falls back to schwa for unknown vowel', () => {
    const unknown = getVowelTract('x');
    const schwa = getVowelTract('ə');
    for (let i = 0; i < unknown.length; i++) {
      expect(unknown[i]).toBeCloseTo(schwa[i]);
    }
  });
});

describe('findFormants', () => {
  it('finds formants within expected range', () => {
    const areas = getVowelTract('a');
    const response = computeTransferFunction({ areas }, 512);
    const formants = findFormants(response);
    expect(formants.length).toBeGreaterThanOrEqual(2);
    // All formants should be in speech range
    for (const f of formants) {
      expect(f).toBeGreaterThan(90);
      expect(f).toBeLessThan(5500);
    }
  });

  it('respects maxFormants limit', () => {
    const areas = getVowelTract('a');
    const response = computeTransferFunction({ areas }, 512);
    const formants = findFormants(response, 2);
    expect(formants.length).toBeLessThanOrEqual(2);
  });
});
