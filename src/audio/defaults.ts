import type { AnalysisSettings, FilterSettings, TextGrid } from '../types';

export const defaultAnalysisSettings: AnalysisSettings = {
  spectrogram: {
    fftSize: 1024,
    hopSize: 256,
    dynamicRangeDb: 70,
    colormap: 'jet',
    windowFunction: 'hanning',
    preEmphasis: 6,
    maxViewFrequency: 5000,
  },
  pitch: {
    minHz: 75,
    maxHz: 600,
    voicingThreshold: 0.50,
    silenceThreshold: 0.09,
    octaveCost: 0.055,
    octaveJumpCost: 0.35,
    voicedUnvoicedCost: 0.14,
    maxCandidates: 15,
  },
  formant: {
    maxFrequency: 5000,
    lpcOrder: 12,
    numberOfFormants: 3,
    smoothingWindowMs: 20,
    transitionCostWeight: 1.0,
    medianFilterSize: 3,
  },
};

export const defaultFilterSettings: FilterSettings = {
  type: 'none',
  cutoffHz: 1000,
  q: Math.SQRT1_2,
};

export function createEmptyTextGrid(duration: number): TextGrid {
  return {
    xmin: 0,
    xmax: duration,
    tiers: [
      {
        id: 'tier-interval',
        name: 'Words',
        kind: 'interval',
        intervals: [{ id: 'interval-0', start: 0, end: duration, label: '' }],
      },
      {
        id: 'tier-points',
        name: 'Events',
        kind: 'point',
        points: [],
      },
    ],
  };
}
