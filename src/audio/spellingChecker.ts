/**
 * SpellingChecker — WordList-based spelling check.
 *
 * Mirrors Praat's SpellingChecker functionality:
 * - WordList: sorted list of words with binary search lookup
 * - SpellingChecker: configurable rules (capitals, abbreviations, prefixes, suffixes, user dictionary)
 * - TextGrid integration: check interval labels for misspellings
 */

// ─── WordList ───────────────────────────────────────────────────────────────────

export interface WordList {
  /** Sorted array of words (lowercase for comparison) */
  words: string[];
}

/**
 * Create a WordList from newline-separated text (as in Praat .WordList files).
 * Words are stored sorted for binary search.
 */
export function createWordList(text: string): WordList {
  const words = text
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  words.sort((a, b) => a.localeCompare(b));
  return { words };
}

/**
 * Binary search: is the word in the list?
 */
export function wordListContains(list: WordList, word: string): boolean {
  const { words } = list;
  let lo = 0;
  let hi = words.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = words[mid].localeCompare(word);
    if (cmp === 0) return true;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/**
 * Serialize WordList back to newline-separated text.
 */
export function serializeWordList(list: WordList): string {
  return list.words.join('\n') + '\n';
}

// ─── SpellingChecker ────────────────────────────────────────────────────────────

export interface SpellingCheckerOptions {
  /** Allow all words starting with a capital letter (proper nouns) */
  allowAllNames?: boolean;
  /** Name prefixes that, when followed by a capital, count as names (e.g., "d'" "mc") */
  namePrefixes?: string[];
  /** Allow all-caps words as abbreviations */
  allowAllAbbreviations?: boolean;
  /** Allow words containing any of these substrings */
  allowAllWordsContaining?: string[];
  /** Allow words starting with any of these prefixes */
  allowAllWordsStartingWith?: string[];
  /** Allow words ending with any of these suffixes */
  allowAllWordsEndingIn?: string[];
  /** Characters that separate words (in addition to whitespace) */
  separatingCharacters?: string;
}

export interface SpellingChecker {
  wordList: WordList;
  userDictionary: Set<string>;
  options: SpellingCheckerOptions;
}

const DEFAULT_SEPARATING_CHARS = '.,;:()"\'!?[]{}–—…\t';

/**
 * Create a SpellingChecker from a WordList.
 */
export function createSpellingChecker(
  wordList: WordList,
  options: SpellingCheckerOptions = {}
): SpellingChecker {
  return {
    wordList,
    userDictionary: new Set(),
    options: {
      separatingCharacters: DEFAULT_SEPARATING_CHARS,
      ...options,
    },
  };
}

/**
 * Add a word to the user dictionary.
 */
export function addToUserDictionary(checker: SpellingChecker, word: string): void {
  checker.userDictionary.add(word.toLowerCase());
}

/**
 * Remove a word from the user dictionary.
 */
export function removeFromUserDictionary(checker: SpellingChecker, word: string): void {
  checker.userDictionary.delete(word.toLowerCase());
}

function startsWithCapital(word: string): boolean {
  return word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
}

function isAllCaps(word: string): boolean {
  return word.length > 0 && word === word.toUpperCase() && word !== word.toLowerCase();
}

/**
 * Check if a single word is allowed by the checker rules.
 */
export function isWordAllowed(checker: SpellingChecker, word: string): boolean {
  if (word.length === 0) return true;

  const { options, wordList, userDictionary } = checker;

  // Check allowAllWordsContaining
  if (options.allowAllWordsContaining) {
    for (const token of options.allowAllWordsContaining) {
      if (token && word.includes(token)) return true;
    }
  }

  // Check allowAllNames (capitalized words)
  if (options.allowAllNames) {
    if (startsWithCapital(word)) return true;
    // Check name prefixes
    if (options.namePrefixes) {
      for (const prefix of options.namePrefixes) {
        if (word.startsWith(prefix) && startsWithCapital(word.slice(prefix.length))) {
          return true;
        }
      }
    }
  } else if (options.allowAllAbbreviations && isAllCaps(word)) {
    return true;
  }

  // Check allowAllWordsStartingWith
  if (options.allowAllWordsStartingWith) {
    for (const prefix of options.allowAllWordsStartingWith) {
      if (prefix && word.startsWith(prefix)) return true;
    }
  }

  // Check allowAllWordsEndingIn
  if (options.allowAllWordsEndingIn) {
    for (const suffix of options.allowAllWordsEndingIn) {
      if (suffix && word.endsWith(suffix)) return true;
    }
  }

  // Check user dictionary
  if (userDictionary.has(word.toLowerCase())) return true;

  // Check main word list (case-insensitive)
  if (wordListContains(wordList, word.toLowerCase())) return true;

  return false;
}

/**
 * Tokenize text into words using separating characters.
 */
export function tokenizeText(text: string, separatingChars?: string): string[] {
  const seps = separatingChars ?? DEFAULT_SEPARATING_CHARS;
  // Build regex from separators + whitespace
  const escaped = seps.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
  const re = new RegExp(`[\\s${escaped}]+`);
  return text.split(re).filter((w) => w.length > 0);
}

export interface SpellingError {
  word: string;
  /** Position in original text */
  offset: number;
}

/**
 * Check a text string and return all misspelled words with positions.
 */
export function checkText(checker: SpellingChecker, text: string): SpellingError[] {
  const errors: SpellingError[] = [];
  const seps = checker.options.separatingCharacters ?? DEFAULT_SEPARATING_CHARS;
  const escaped = seps.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
  const re = new RegExp(`[^\\s${escaped}]+`, 'g');

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const word = match[0];
    if (!isWordAllowed(checker, word)) {
      errors.push({ word, offset: match.index });
    }
  }
  return errors;
}

/**
 * Check TextGrid interval labels for spelling errors.
 */
export interface TextGridSpellingError extends SpellingError {
  tierIndex: number;
  intervalIndex: number;
}

export interface TextGridInterval {
  text: string;
}

export interface TextGridTier {
  type: 'interval' | 'point';
  intervals?: TextGridInterval[];
}

export function checkTextGrid(
  checker: SpellingChecker,
  tiers: TextGridTier[]
): TextGridSpellingError[] {
  const errors: TextGridSpellingError[] = [];
  for (let ti = 0; ti < tiers.length; ti++) {
    const tier = tiers[ti];
    if (tier.type !== 'interval' || !tier.intervals) continue;
    for (let ii = 0; ii < tier.intervals.length; ii++) {
      const label = tier.intervals[ii].text;
      if (!label) continue;
      const textErrors = checkText(checker, label);
      for (const err of textErrors) {
        errors.push({ ...err, tierIndex: ti, intervalIndex: ii });
      }
    }
  }
  return errors;
}
