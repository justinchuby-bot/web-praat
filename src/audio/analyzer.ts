import { fftMagnitude, hammingWindow } from '../utils/fft';
import { defaultAnalysisSettings } from './defaults';
import { extractFormants } from './lpc';
import { trackFormants } from './formantTracking';
import { computeHarmonicity } from './harmonicity';
import { computeVoiceQuality } from './voiceQuality';
import type {
  AnalysisResult,
  AnalysisSettings,
  FormantData,
  FormantFrame,
  IntensityData,
  PitchData,
  SpectrogramData,
} from '../types';

function mergeSettings(settings?: Partial<AnalysisSettings>): AnalysisSettings {
  return {
    spectrogram: { ...defaultAnalysisSettings.spectrogram, ...settings?.spectrogram },
    pitch: { ...defaultAnalysisSettings.pitch, ...settings?.pitch },
    formant: { ...defaultAnalysisSettings.formant, ...settings?.formant },
  };
}

export function analyzeAudio(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>
): AnalysisResult {
  const resolved = mergeSettings(settings);
  const duration = samples.length / sampleRate;
  const spectrogram = computeSpectrogram(samples, sampleRate, resolved);
  const pitch = computePitch(samples, sampleRate, resolved);
  const formants = computeFormants(samples, sampleRate, resolved);
  const intensity = computeIntensity(samples, sampleRate);
  const harmonicity = computeHarmonicity(samples, sampleRate);
  const voiceQuality = computeVoiceQuality(samples, sampleRate);

  return {
    waveform: Float32Array.from(samples),
    sampleRate,
    duration,
    spectrogram,
    pitch,
    formants,
    intensity,
    harmonicity,
    voiceQuality,
    spectrumSlice: null,
    settings: resolved,
  };
}

export function computeSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>
): SpectrogramData {
  const resolved = mergeSettings(settings);
  const fftSize = resolved.spectrogram.fftSize;
  const hopSize = resolved.spectrogram.hopSize;
  const magnitudes: Float64Array[] = [];
  const frameTimes: number[] = [];
  const totalFrames = Math.max(0, Math.floor((samples.length - fftSize) / hopSize) + 1);

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const start = frameIndex * hopSize;
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frame[i] = start + i < samples.length ? samples[start + i] : 0;
    }
    magnitudes.push(fftMagnitude(hammingWindow(frame), fftSize));
    frameTimes.push((start + fftSize / 2) / sampleRate);
  }

  return {
    magnitudes,
    timeStep: hopSize / sampleRate,
    freqStep: sampleRate / fftSize,
    maxFreq: sampleRate / 2,
    frameTimes,
  };
}

export function computePitch(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>
): PitchData {
  const resolved = mergeSettings(settings);
  const frameSize = Math.round(sampleRate * 0.04);
  const hopSize = Math.max(1, Math.round(sampleRate * 0.01));
  const minLag = Math.round(sampleRate / resolved.pitch.maxHz);
  const maxLag = Math.round(sampleRate / resolved.pitch.minHz);

  const times: number[] = [];
  const frequencies: Array<number | null> = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);
    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i];
    }
    const windowed = hammingWindow(frame);
    let energy = 0;
    for (let i = 0; i < windowed.length; i++) energy += windowed[i] * windowed[i];
    if (energy < 1e-6) {
      frequencies.push(null);
      continue;
    }

    let bestLag = 0;
    let bestCorrelation = 0;
    for (let lag = minLag; lag <= Math.min(maxLag, frameSize - 1); lag++) {
      let numerator = 0;
      let denominator1 = 0;
      let denominator2 = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        numerator += windowed[i] * windowed[i + lag];
        denominator1 += windowed[i] * windowed[i];
        denominator2 += windowed[i + lag] * windowed[i + lag];
      }
      const denom = Math.sqrt(denominator1 * denominator2);
      const correlation = denom > 0 ? numerator / denom : 0;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }

    frequencies.push(bestCorrelation >= resolved.pitch.voicingThreshold && bestLag > 0 ? sampleRate / bestLag : null);
  }

  return { times, frequencies };
}

export function computeFormants(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>
): FormantData {
  const resolved = mergeSettings(settings);
  const frameSize = Math.round(sampleRate * 0.025);
  const hopSize = Math.max(1, Math.round(sampleRate * 0.01));
  const times: number[] = [];
  const frames: FormantFrame[] = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i];
    }
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);
    const result = extractFormants(
      frame,
      sampleRate,
      resolved.formant.lpcOrder,
      resolved.formant.maxFrequency
    );
    frames.push({
      time,
      candidates: result?.candidates.map((candidate) => candidate.freq) ?? [],
    });
  }

  const tracked = trackFormants(frames, resolved.formant.numberOfFormants);
  const [f1, f2, f3] = tracked;

  return {
    times,
    f1: f1 ?? new Array(times.length).fill(null),
    f2: f2 ?? new Array(times.length).fill(null),
    f3: f3 ?? new Array(times.length).fill(null),
    tracked,
    candidates: frames,
  };
}

export function computeIntensity(samples: Float32Array, sampleRate: number): IntensityData {
  const frameSize = Math.round(sampleRate * 0.032);
  const hopSize = Math.max(1, Math.round(sampleRate * 0.01));
  const times: number[] = [];
  const values: number[] = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let energy = 0;
    for (let i = 0; i < frameSize; i++) {
      energy += samples[start + i] * samples[start + i];
    }
    const rms = Math.sqrt(energy / frameSize);
    values.push(rms > 0 ? 20 * Math.log10(rms) : -100);
    times.push((start + frameSize / 2) / sampleRate);
  }

  return { times, values };
}
