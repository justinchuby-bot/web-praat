import { describe, it, expect } from 'vitest';
import {
  isValidLabel,
  getSuggestions,
  parseWordList,
  serializeWordList,
  validateTierLabels,
  createVocabulary,
  type ControlledVocabulary,
} from '../src/textgrid/vocabulary';

const sampleVocab: ControlledVocabulary = {
  id: 'v1',
  name: 'Phonemes',
  entries: [
    { value: 'aa', description: 'open front unrounded' },
    { value: 'ae', description: 'near-open front unrounded' },
    { value: 'ah' },
    { value: 'ao' },
    { value: 'aw' },
    { value: 'b' },
    { value: 'ch' },
    { value: 'sil', description: 'silence' },
  ],
};

describe('vocabulary', () => {
  describe('isValidLabel', () => {
    it('empty label always valid', () => {
      expect(isValidLabel('', sampleVocab, true)).toBe(true);
    });

    it('valid label in strict mode', () => {
      expect(isValidLabel('aa', sampleVocab, true)).toBe(true);
    });

    it('invalid label in strict mode', () => {
      expect(isValidLabel('zz', sampleVocab, true)).toBe(false);
    });

    it('any label valid in non-strict mode', () => {
      expect(isValidLabel('anything', sampleVocab, false)).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    it('returns all entries for empty input (up to limit)', () => {
      const results = getSuggestions('', sampleVocab, 5);
      expect(results).toHaveLength(5);
    });

    it('filters by prefix', () => {
      const results = getSuggestions('a', sampleVocab);
      expect(results.every((r) => r.value.includes('a'))).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('exact match comes first', () => {
      const results = getSuggestions('aa', sampleVocab);
      expect(results[0].value).toBe('aa');
    });

    it('returns empty for no matches', () => {
      const results = getSuggestions('xyz', sampleVocab);
      expect(results).toHaveLength(0);
    });
  });

  describe('parseWordList', () => {
    it('parses simple word list', () => {
      const entries = parseWordList('hello\nworld\n');
      expect(entries).toEqual([{ value: 'hello' }, { value: 'world' }]);
    });

    it('parses tab-separated descriptions', () => {
      const entries = parseWordList('aa\topen front\nae\tnear-open');
      expect(entries).toEqual([
        { value: 'aa', description: 'open front' },
        { value: 'ae', description: 'near-open' },
      ]);
    });

    it('skips empty lines and comments', () => {
      const entries = parseWordList('# comment\nhello\n\nworld\n');
      expect(entries).toEqual([{ value: 'hello' }, { value: 'world' }]);
    });
  });

  describe('serializeWordList', () => {
    it('serializes entries', () => {
      const text = serializeWordList([
        { value: 'aa', description: 'vowel' },
        { value: 'b' },
      ]);
      expect(text).toBe('aa\tvowel\nb');
    });
  });

  describe('validateTierLabels', () => {
    it('returns empty for all valid labels', () => {
      const result = validateTierLabels(['aa', 'b', ''], sampleVocab, true);
      expect(result).toEqual([]);
    });

    it('returns indices of invalid labels', () => {
      const result = validateTierLabels(['aa', 'INVALID', 'b', 'nope'], sampleVocab, true);
      expect(result).toEqual([1, 3]);
    });

    it('non-strict mode returns empty', () => {
      const result = validateTierLabels(['anything', 'goes'], sampleVocab, false);
      expect(result).toEqual([]);
    });
  });

  describe('createVocabulary', () => {
    it('creates vocab with entries', () => {
      const v = createVocabulary('id1', 'Test', [{ value: 'x' }]);
      expect(v.id).toBe('id1');
      expect(v.name).toBe('Test');
      expect(v.entries).toHaveLength(1);
    });
  });
});
