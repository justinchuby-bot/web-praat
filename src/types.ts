export interface AnalysisResult {
  waveform: Float32Array;
  sampleRate: number;
  duration: number;
  spectrogram: SpectrogramData;
  pitch: PitchData;
  formants: FormantData;
  intensity: IntensityData;
}

export interface SpectrogramData {
  magnitudes: Float64Array[]; // Each element is one frame's frequency bins
  timeStep: number; // seconds per frame
  freqStep: number; // Hz per bin
  maxFreq: number;
}

export interface PitchData {
  times: number[];
  frequencies: (number | null)[]; // null = unvoiced
}

export interface FormantData {
  times: number[];
  f1: (number | null)[];
  f2: (number | null)[];
  f3: (number | null)[];
}

export interface IntensityData {
  times: number[];
  values: number[]; // dB
}

export interface TimeSelection {
  start: number;
  end: number;
}
