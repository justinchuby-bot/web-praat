import { describe, it, expect } from 'vitest';
import { findClosestVowel, hzToBark, barkDistance, vowelTargets } from '../src/audio/ipaMapper';

describe('ipaMapper', () => {
  describe('hzToBark', () => {
    it('converts known frequencies correctly', () => {
      // Bark(1000 Hz) ≈ 8.5
      const bark1k = hzToBark(1000);
      expect(bark1k).toBeCloseTo(8.5, 0);
    });

    it('is monotonically increasing', () => {
      const freqs = [100, 300, 500, 1000, 2000, 3000];
      for (let i = 1; i < freqs.length; i++) {
        expect(hzToBark(freqs[i])).toBeGreaterThan(hzToBark(freqs[i - 1]));
      }
    });

    it('handles low frequencies', () => {
      expect(hzToBark(100)).toBeGreaterThan(0);
    });
  });

  describe('barkDistance', () => {
    it('returns 0 for identical points', () => {
      expect(barkDistance(500, 1500, 500, 1500)).toBe(0);
    });

    it('returns positive for different points', () => {
      expect(barkDistance(300, 2300, 700, 1200)).toBeGreaterThan(0);
    });

    it('is symmetric', () => {
      const d1 = barkDistance(300, 2300, 700, 1200);
      const d2 = barkDistance(700, 1200, 300, 2300);
      expect(d1).toBeCloseTo(d2, 10);
    });
  });

  describe('findClosestVowel', () => {
    it('maps [i] correctly (F1~300, F2~2300)', () => {
      const result = findClosestVowel(300, 2300);
      expect(result.ipa).toBe('i');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [u] correctly (F1~300, F2~800)', () => {
      const result = findClosestVowel(300, 800);
      expect(result.ipa).toBe('u');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [ɑ] or [a] correctly (F1~700, F2~1200)', () => {
      const result = findClosestVowel(700, 1200);
      expect(['a', 'ɑ']).toContain(result.ipa);
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [æ] correctly (F1~700, F2~1700)', () => {
      const result = findClosestVowel(700, 1700);
      expect(result.ipa).toBe('æ');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [ə] correctly (F1~500, F2~1500)', () => {
      const result = findClosestVowel(500, 1500);
      expect(result.ipa).toBe('ə');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [ɛ] correctly (F1~550, F2~1800)', () => {
      const result = findClosestVowel(550, 1800);
      expect(result.ipa).toBe('ɛ');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [ɔ] correctly (F1~600, F2~900)', () => {
      const result = findClosestVowel(600, 900);
      expect(result.ipa).toBe('ɔ');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [ʌ] correctly (F1~600, F2~1200)', () => {
      const result = findClosestVowel(600, 1200);
      expect(result.ipa).toBe('ʌ');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [o] correctly (F1~450, F2~800)', () => {
      const result = findClosestVowel(450, 800);
      expect(result.ipa).toBe('o');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('maps [ʊ] correctly (F1~400, F2~1000)', () => {
      const result = findClosestVowel(400, 1000);
      expect(result.ipa).toBe('ʊ');
      expect(result.distance).toBeLessThan(0.5);
    });

    it('returns higher distance for ambiguous midpoints', () => {
      // Point equidistant from multiple vowels
      const result = findClosestVowel(450, 1400);
      expect(result.distance).toBeGreaterThan(0.3);
    });

    it('all vowel targets have valid ranges', () => {
      for (const t of vowelTargets) {
        expect(t.f1).toBeGreaterThan(100);
        expect(t.f1).toBeLessThan(1000);
        expect(t.f2).toBeGreaterThan(500);
        expect(t.f2).toBeLessThan(3000);
      }
    });
  });
});
