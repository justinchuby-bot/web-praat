/**
 * Controlled Vocabulary — predefined word lists for TextGrid tier annotation.
 * Inspired by Praat's WordList and ELAN's controlled vocabularies.
 */

export interface VocabularyEntry {
  value: string;
  description?: string;
}

export interface ControlledVocabulary {
  id: string;
  name: string;
  language?: string;
  entries: VocabularyEntry[];
}

export interface TierVocabularyBinding {
  tierId: string;
  vocabularyId: string;
  /** If true, only allow entries from the vocabulary (no free text). */
  strict: boolean;
}

/**
 * Check if a label is valid given a vocabulary (strict mode).
 * Empty labels are always valid (allow unlabeled intervals/points).
 */
export function isValidLabel(
  label: string,
  vocabulary: ControlledVocabulary,
  strict: boolean
): boolean {
  if (label === '') return true;
  if (!strict) return true;
  return vocabulary.entries.some((e) => e.value === label);
}

/**
 * Get suggestions for a partial input, sorted by relevance.
 */
export function getSuggestions(
  input: string,
  vocabulary: ControlledVocabulary,
  limit = 10
): VocabularyEntry[] {
  if (input === '') return vocabulary.entries.slice(0, limit);
  const lower = input.toLowerCase();
  const exact: VocabularyEntry[] = [];
  const startsWith: VocabularyEntry[] = [];
  const contains: VocabularyEntry[] = [];

  for (const entry of vocabulary.entries) {
    const val = entry.value.toLowerCase();
    if (val === lower) {
      exact.push(entry);
    } else if (val.startsWith(lower)) {
      startsWith.push(entry);
    } else if (val.includes(lower)) {
      contains.push(entry);
    }
  }

  return [...exact, ...startsWith, ...contains].slice(0, limit);
}

/**
 * Parse a plain-text word list (one word per line, optional tab-separated description).
 */
export function parseWordList(text: string): VocabularyEntry[] {
  const entries: VocabularyEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const tabIdx = trimmed.indexOf('\t');
    if (tabIdx >= 0) {
      entries.push({
        value: trimmed.slice(0, tabIdx).trim(),
        description: trimmed.slice(tabIdx + 1).trim() || undefined,
      });
    } else {
      entries.push({ value: trimmed });
    }
  }
  return entries;
}

/**
 * Serialize vocabulary entries to plain-text format.
 */
export function serializeWordList(entries: VocabularyEntry[]): string {
  return entries
    .map((e) => (e.description ? `${e.value}\t${e.description}` : e.value))
    .join('\n');
}

/**
 * Validate all labels in a tier against a vocabulary.
 * Returns indices of invalid labels.
 */
export function validateTierLabels(
  labels: string[],
  vocabulary: ControlledVocabulary,
  strict: boolean
): number[] {
  const invalid: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (!isValidLabel(labels[i], vocabulary, strict)) {
      invalid.push(i);
    }
  }
  return invalid;
}

/**
 * Create a new empty controlled vocabulary.
 */
export function createVocabulary(
  id: string,
  name: string,
  entries: VocabularyEntry[] = []
): ControlledVocabulary {
  return { id, name, entries };
}
