export type FilterType = 'none' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export type TextGridTierKind = 'interval' | 'point';
export type ColormapName = 'jet' | 'grayscale' | 'viridis' | 'magma';
export type WindowFunction = 'hanning' | 'hamming' | 'gaussian' | 'bartlett' | 'rectangular';

export interface AnalysisSettings {
  spectrogram: {
    fftSize: 256 | 512 | 1024 | 2048 | 4096;
    hopSize: number;
    dynamicRangeDb: number;
    colormap: ColormapName;
    windowFunction: WindowFunction;
    preEmphasis: number;
    maxViewFrequency: number;
  };
  pitch: {
    minHz: number;
    maxHz: number;
    voicingThreshold: number;
    silenceThreshold: number;
    octaveCost: number;
    octaveJumpCost: number;
    voicedUnvoicedCost: number;
    maxCandidates: number;
  };
  formant: {
    maxFrequency: number;
    lpcOrder: number;
    numberOfFormants: number;
    smoothingWindowMs: number;
    transitionCostWeight: number;
    medianFilterSize: number;
  };
}

export interface SpectrumSliceData {
  time: number;
  fftFrequencies: Float64Array;
  fftMagnitudes: Float64Array;
  lpcEnvelope: Float64Array;
}

export interface VoiceQualityMetrics {
  pulses: number[];
  periodDurations: number[];
  pulseAmplitudes: number[];
  jitterLocalPercent: number;
  jitterAbsolute: number;
  rap: number;
  ppq5: number;
  shimmerLocalPercent: number;
  shimmerDb: number;
  apq3: number;
  apq5: number;
}

export interface RhythmMetrics {
  count: number;
  mean: number;
  stdev: number;
  min: number;
  max: number;
  nPVI: number;
  rPVI: number;
}

export interface FormantFrame {
  time: number;
  candidates: number[];
}

export interface HarmonicityData {
  times: number[];
  values: number[];
  meanHnrDb: number;
  medianHnrDb: number;
}

export interface AnalysisResult {
  waveform: Float32Array;
  sampleRate: number;
  duration: number;
  spectrogram: SpectrogramData;
  pitch: PitchData;
  formants: FormantData;
  intensity: IntensityData;
  harmonicity: HarmonicityData;
  voiceQuality: VoiceQualityMetrics;
  spectrumSlice: SpectrumSliceData | null;
  settings: AnalysisSettings;
}

export interface SpectrogramData {
  magnitudes: Float64Array[];
  timeStep: number;
  freqStep: number;
  maxFreq: number;
  frameTimes: number[];
  gpuAccelerated?: boolean;
}

export interface PitchData {
  times: number[];
  frequencies: (number | null)[];
}

export interface FormantData {
  times: number[];
  f1: (number | null)[];
  f2: (number | null)[];
  f3: (number | null)[];
  tracked: Array<Array<number | null>>;
  candidates: FormantFrame[];
}

export interface IntensityData {
  times: number[];
  values: number[];
}

export interface TimeSelection {
  start: number;
  end: number;
}

export interface ViewRange {
  start: number;
  end: number;
}

export interface Interval {
  id: string;
  start: number;
  end: number;
  label: string;
}

export interface Point {
  id: string;
  time: number;
  label: string;
}

export interface IntervalTier {
  id: string;
  name: string;
  kind: 'interval';
  intervals: Interval[];
}

export interface PointTier {
  id: string;
  name: string;
  kind: 'point';
  points: Point[];
}

export type TextGridTier = IntervalTier | PointTier;

export interface TextGrid {
  xmin: number;
  xmax: number;
  tiers: TextGridTier[];
}

export interface FilterSettings {
  type: FilterType;
  cutoffHz: number;
  q: number;
}

export interface ExportSeriesRow {
  time: number;
  value: number | null;
}

export interface PitchTierPoint {
  time: number;
  frequency: number;
}

export interface DurationTierPoint {
  time: number;
  factor: number;
}

export interface ManipulationData {
  pitchTier: PitchTierPoint[];
  durationTier: DurationTierPoint[];
  originalPulses: number[];
}
