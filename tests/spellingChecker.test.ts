import { describe, it, expect } from 'vitest';
import {
  createWordList,
  wordListContains,
  serializeWordList,
  createSpellingChecker,
  addToUserDictionary,
  removeFromUserDictionary,
  isWordAllowed,
  tokenizeText,
  checkText,
  checkTextGrid,
} from '../src/audio/spellingChecker';

describe('WordList', () => {
  const list = createWordList('banana\napple\ncherry\ndate');

  it('creates sorted word list', () => {
    expect(list.words).toEqual(['apple', 'banana', 'cherry', 'date']);
  });

  it('binary search finds words', () => {
    expect(wordListContains(list, 'apple')).toBe(true);
    expect(wordListContains(list, 'banana')).toBe(true);
    expect(wordListContains(list, 'date')).toBe(true);
    expect(wordListContains(list, 'grape')).toBe(false);
    expect(wordListContains(list, '')).toBe(false);
  });

  it('serializes back to text', () => {
    const text = serializeWordList(list);
    expect(text).toBe('apple\nbanana\ncherry\ndate\n');
  });
});

describe('SpellingChecker', () => {
  const wordList = createWordList('hello\nworld\nthe\nis\na\ntest');

  it('allows words in the list (case-insensitive)', () => {
    const checker = createSpellingChecker(wordList);
    expect(isWordAllowed(checker, 'hello')).toBe(true);
    expect(isWordAllowed(checker, 'Hello')).toBe(true); // case-insensitive lookup
    expect(isWordAllowed(checker, 'unknown')).toBe(false);
  });

  it('allows all names (capitalized words)', () => {
    const checker = createSpellingChecker(wordList, { allowAllNames: true });
    expect(isWordAllowed(checker, 'John')).toBe(true);
    expect(isWordAllowed(checker, 'unknown')).toBe(false);
  });

  it('allows names with prefixes', () => {
    const checker = createSpellingChecker(wordList, {
      allowAllNames: true,
      namePrefixes: ["d'", 'mc'],
    });
    expect(isWordAllowed(checker, "d'Artagnan")).toBe(true);
    expect(isWordAllowed(checker, 'mcDonald')).toBe(true); // 'D' is capital after 'mc'
    expect(isWordAllowed(checker, 'McDonald')).toBe(true);
  });

  it('allows abbreviations (all caps)', () => {
    const checker = createSpellingChecker(wordList, { allowAllAbbreviations: true });
    expect(isWordAllowed(checker, 'NASA')).toBe(true);
    expect(isWordAllowed(checker, 'Nasa')).toBe(false);
  });

  it('allows words containing substring', () => {
    const checker = createSpellingChecker(wordList, {
      allowAllWordsContaining: ['http'],
    });
    expect(isWordAllowed(checker, 'https://example.com')).toBe(true);
    expect(isWordAllowed(checker, 'random')).toBe(false);
  });

  it('allows words starting with prefix', () => {
    const checker = createSpellingChecker(wordList, {
      allowAllWordsStartingWith: ['pre'],
    });
    expect(isWordAllowed(checker, 'prefix')).toBe(true);
    expect(isWordAllowed(checker, 'suffix')).toBe(false);
  });

  it('allows words ending with suffix', () => {
    const checker = createSpellingChecker(wordList, {
      allowAllWordsEndingIn: ['-tion'],
    });
    expect(isWordAllowed(checker, 'action-tion')).toBe(true);
    expect(isWordAllowed(checker, 'action')).toBe(false);
  });

  it('user dictionary add/remove', () => {
    const checker = createSpellingChecker(wordList);
    expect(isWordAllowed(checker, 'custom')).toBe(false);
    addToUserDictionary(checker, 'custom');
    expect(isWordAllowed(checker, 'custom')).toBe(true);
    expect(isWordAllowed(checker, 'Custom')).toBe(true); // case-insensitive
    removeFromUserDictionary(checker, 'custom');
    expect(isWordAllowed(checker, 'custom')).toBe(false);
  });

  it('empty word is always allowed', () => {
    const checker = createSpellingChecker(wordList);
    expect(isWordAllowed(checker, '')).toBe(true);
  });
});

describe('tokenizeText', () => {
  it('splits on whitespace and punctuation', () => {
    expect(tokenizeText('Hello, world!')).toEqual(['Hello', 'world']);
  });

  it('handles multiple separators', () => {
    expect(tokenizeText('one...two;;three')).toEqual(['one', 'two', 'three']);
  });
});

describe('checkText', () => {
  const wordList = createWordList('the\ncat\nsat\non\nmat');
  const checker = createSpellingChecker(wordList);

  it('finds misspelled words with offsets', () => {
    const errors = checkText(checker, 'the cat sat on a mat');
    expect(errors).toHaveLength(1);
    expect(errors[0].word).toBe('a');
  });

  it('returns empty for correct text', () => {
    const errors = checkText(checker, 'the cat sat on mat');
    expect(errors).toHaveLength(0);
  });
});

describe('checkTextGrid', () => {
  const wordList = createWordList('hello\nworld');
  const checker = createSpellingChecker(wordList);

  it('checks interval tier labels', () => {
    const tiers = [
      {
        type: 'interval' as const,
        intervals: [
          { text: 'hello' },
          { text: 'oops' },
          { text: '' },
        ],
      },
    ];
    const errors = checkTextGrid(checker, tiers);
    expect(errors).toHaveLength(1);
    expect(errors[0].word).toBe('oops');
    expect(errors[0].tierIndex).toBe(0);
    expect(errors[0].intervalIndex).toBe(1);
  });

  it('skips point tiers', () => {
    const tiers = [{ type: 'point' as const }];
    const errors = checkTextGrid(checker, tiers);
    expect(errors).toHaveLength(0);
  });
});
