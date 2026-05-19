/**
 * Automatic IPA vowel annotation based on F1/F2 values.
 *
 * Uses standard reference values for cardinal vowels from
 * Hillenbrand et al. (1995) and IPA handbook norms.
 * F1 correlates with vowel height (open/close), F2 with frontness/backness.
 */

export interface VowelReference {
  symbol: string;
  f1: number;
  f2: number;
  description: string;
}

/**
 * Reference vowel formant values (adult averages, Hz).
 * Sources: Hillenbrand et al. (1995), Peterson & Barney (1952), IPA norms.
 */
export const vowelReferences: VowelReference[] = [
  // Close front
  { symbol: 'i', f1: 270, f2: 2290, description: 'close front unrounded' },
  { symbol: 'y', f1: 235, f2: 2100, description: 'close front rounded' },
  { symbol: 'ɪ', f1: 390, f2: 1990, description: 'near-close near-front unrounded' },
  // Close-mid front
  { symbol: 'e', f1: 390, f2: 2300, description: 'close-mid front unrounded' },
  { symbol: 'ø', f1: 370, f2: 1900, description: 'close-mid front rounded' },
  // Open-mid front
  { symbol: 'ɛ', f1: 550, f2: 1770, description: 'open-mid front unrounded' },
  { symbol: 'œ', f1: 585, f2: 1710, description: 'open-mid front rounded' },
  // Open front
  { symbol: 'æ', f1: 660, f2: 1720, description: 'near-open front unrounded' },
  { symbol: 'a', f1: 730, f2: 1370, description: 'open front unrounded' },
  // Central
  { symbol: 'ə', f1: 500, f2: 1500, description: 'mid central' },
  { symbol: 'ɐ', f1: 600, f2: 1400, description: 'near-open central' },
  { symbol: 'ɨ', f1: 300, f2: 1600, description: 'close central unrounded' },
  // Close back
  { symbol: 'u', f1: 300, f2: 870, description: 'close back rounded' },
  { symbol: 'ʊ', f1: 440, f2: 1020, description: 'near-close near-back rounded' },
  // Close-mid back
  { symbol: 'o', f1: 360, f2: 880, description: 'close-mid back rounded' },
  { symbol: 'ɤ', f1: 360, f2: 1200, description: 'close-mid back unrounded' },
  // Open-mid back
  { symbol: 'ɔ', f1: 590, f2: 880, description: 'open-mid back rounded' },
  { symbol: 'ʌ', f1: 600, f2: 1170, description: 'open-mid back unrounded' },
  // Open back
  { symbol: 'ɑ', f1: 730, f2: 1090, description: 'open back unrounded' },
  { symbol: 'ɒ', f1: 700, f2: 760, description: 'open back rounded' },
];

export interface IpaAnnotation {
  time: number;
  symbol: string;
  f1: number;
  f2: number;
  confidence: number; // 0-1, based on distance to nearest reference
}

/**
 * Compute Euclidean distance in the F1/F2 vowel space.
 * F1 and F2 are weighted differently since F2 has a larger range.
 * We use Bark-scale normalization for perceptual accuracy.
 */
function hzToBark(hz: number): number {
  return 26.81 / (1 + 1960 / hz) - 0.53;
}

function vowelDistance(f1a: number, f2a: number, f1b: number, f2b: number): number {
  const b1a = hzToBark(f1a);
  const b2a = hzToBark(f2a);
  const b1b = hzToBark(f1b);
  const b2b = hzToBark(f2b);
  return Math.sqrt((b1a - b1b) ** 2 + (b2a - b2b) ** 2);
}

/**
 * Find the closest IPA vowel for given F1/F2 values.
 */
export function classifyVowel(f1: number, f2: number): { symbol: string; confidence: number } {
  let minDist = Infinity;
  let bestSymbol = '?';

  for (const ref of vowelReferences) {
    const dist = vowelDistance(f1, f2, ref.f1, ref.f2);
    if (dist < minDist) {
      minDist = dist;
      bestSymbol = ref.symbol;
    }
  }

  // Confidence: map distance to 0-1 range. Distance of 0 = 1.0, distance > 3 Bark = 0
  const confidence = Math.max(0, 1 - minDist / 3);
  return { symbol: bestSymbol, confidence };
}

export interface IpaAnnotationOptions {
  /** Minimum confidence threshold (0-1) to include an annotation */
  minConfidence: number;
  /** Minimum time gap between annotations in seconds (to avoid clutter) */
  minTimeGap: number;
  /** Minimum intensity (dB) to consider a frame voiced */
  minIntensityDb: number;
}

const defaultOptions: IpaAnnotationOptions = {
  minConfidence: 0.4,
  minTimeGap: 0.05,
  minIntensityDb: -40,
};

/**
 * Generate IPA vowel annotations from formant tracking data.
 * Only annotates frames where both F1 and F2 are present (voiced segments).
 */
export function generateIpaAnnotations(
  times: number[],
  f1: (number | null)[],
  f2: (number | null)[],
  intensityValues?: number[],
  options?: Partial<IpaAnnotationOptions>
): IpaAnnotation[] {
  const opts = { ...defaultOptions, ...options };
  const annotations: IpaAnnotation[] = [];
  let lastAnnotationTime = -Infinity;

  for (let i = 0; i < times.length; i++) {
    const f1Val = f1[i];
    const f2Val = f2[i];
    if (f1Val === null || f2Val === null) continue;

    // Skip if below intensity threshold
    if (intensityValues && intensityValues[i] !== undefined && intensityValues[i] < opts.minIntensityDb) {
      continue;
    }

    // Skip if F1/F2 values are implausible
    if (f1Val < 150 || f1Val > 1000 || f2Val < 500 || f2Val > 3000) continue;

    // Enforce minimum time gap
    if (times[i] - lastAnnotationTime < opts.minTimeGap) continue;

    const { symbol, confidence } = classifyVowel(f1Val, f2Val);
    if (confidence >= opts.minConfidence) {
      annotations.push({ time: times[i], symbol, f1: f1Val, f2: f2Val, confidence });
      lastAnnotationTime = times[i];
    }
  }

  return annotations;
}
