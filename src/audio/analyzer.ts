import { fftMagnitude, hammingWindow, applyWindow, preEmphasis, batchFftMagnitude } from '../utils/fft';
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
  return analyzeAudioWithProgress(samples, sampleRate, settings);
}

export function analyzeAudioWithProgress(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>,
  onProgress?: (value: number) => void
): AnalysisResult {
  const resolved = mergeSettings(settings);
  const duration = samples.length / sampleRate;

  onProgress?.(0);
  const spectrogram = computeSpectrogram(samples, sampleRate, resolved);
  onProgress?.(20);
  const pitch = computePitch(samples, sampleRate, resolved);
  onProgress?.(40);
  const formants = computeFormants(samples, sampleRate, resolved);
  onProgress?.(60);
  const intensity = computeIntensity(samples, sampleRate);
  const harmonicity = computeHarmonicity(samples, sampleRate);
  onProgress?.(80);
  const voiceQuality = computeVoiceQuality(samples, sampleRate);
  onProgress?.(100);

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

/**
 * GPU-accelerated analysis. Uses batch FFT for spectrogram when GPU is available.
 */
export async function analyzeAudioAsync(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>,
  onProgress?: (value: number) => void
): Promise<AnalysisResult> {
  const resolved = mergeSettings(settings);
  const duration = samples.length / sampleRate;

  onProgress?.(0);
  const spectrogram = await computeSpectrogramAsync(samples, sampleRate, resolved);
  onProgress?.(20);
  const pitch = computePitch(samples, sampleRate, resolved);
  onProgress?.(40);
  const formants = computeFormants(samples, sampleRate, resolved);
  onProgress?.(60);
  const intensity = computeIntensity(samples, sampleRate);
  const harmonicity = computeHarmonicity(samples, sampleRate);
  onProgress?.(80);
  const voiceQuality = computeVoiceQuality(samples, sampleRate);
  onProgress?.(100);

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
  const windowFunction = resolved.spectrogram.windowFunction;
  const preEmphasisDb = resolved.spectrogram.preEmphasis;
  const magnitudes: Float64Array[] = [];
  const frameTimes: number[] = [];
  const totalFrames = Math.max(0, Math.floor((samples.length - fftSize) / hopSize) + 1);

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const start = frameIndex * hopSize;
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frame[i] = start + i < samples.length ? samples[start + i] : 0;
    }
    const emphasized = preEmphasis(frame, preEmphasisDb);
    magnitudes.push(fftMagnitude(applyWindow(emphasized, windowFunction), fftSize));
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

/**
 * GPU-accelerated spectrogram computation. Uses batch FFT for parallelism.
 * Falls back to CPU if GPU is unavailable.
 */
export async function computeSpectrogramAsync(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>
): Promise<SpectrogramData> {
  const resolved = mergeSettings(settings);
  const fftSize = resolved.spectrogram.fftSize;
  const hopSize = resolved.spectrogram.hopSize;
  const windowFunction = resolved.spectrogram.windowFunction;
  const preEmphasisDb = resolved.spectrogram.preEmphasis;
  const totalFrames = Math.max(0, Math.floor((samples.length - fftSize) / hopSize) + 1);
  const frameTimes: number[] = [];

  // Prepare all frames
  const windowedFrames: Float64Array[] = [];
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const start = frameIndex * hopSize;
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frame[i] = start + i < samples.length ? samples[start + i] : 0;
    }
    const emphasized = preEmphasis(frame, preEmphasisDb);
    windowedFrames.push(applyWindow(emphasized, windowFunction));
    frameTimes.push((start + fftSize / 2) / sampleRate);
  }

  // Batch FFT (GPU if available, CPU fallback)
  const magnitudes = await batchFftMagnitude(windowedFrames, fftSize);

  return {
    magnitudes,
    timeStep: hopSize / sampleRate,
    freqStep: sampleRate / fftSize,
    maxFreq: sampleRate / 2,
    frameTimes,
  };
}

interface PitchCandidate {
  frequency: number; // 0 means unvoiced
  strength: number;
}

export function computePitch(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<AnalysisSettings>
): PitchData {
  const resolved = mergeSettings(settings);
  const ps = resolved.pitch;
  const frameSize = Math.round(sampleRate * 0.04);
  const hopSize = Math.max(1, Math.round(sampleRate * 0.01));
  const minLag = Math.round(sampleRate / ps.maxHz);
  const maxLag = Math.round(sampleRate / ps.minHz);
  const timeStep = hopSize / sampleRate;

  // Compute global max amplitude for silence threshold
  let globalMax = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > globalMax) globalMax = a;
  }

  const times: number[] = [];
  const frameCandidates: PitchCandidate[][] = [];

  // Step 1: Collect candidates per frame
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const time = (start + frameSize / 2) / sampleRate;
    times.push(time);
    const frame = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) frame[i] = samples[start + i];
    const windowed = hammingWindow(frame);

    // Check silence
    let frameMax = 0;
    for (let i = 0; i < windowed.length; i++) {
      const a = Math.abs(windowed[i]);
      if (a > frameMax) frameMax = a;
    }
    const isSilent = globalMax > 0 && frameMax / globalMax < ps.silenceThreshold;

    // Unvoiced candidate always present
    const candidates: PitchCandidate[] = [{ frequency: 0, strength: ps.voicingThreshold }];

    if (!isSilent) {
      // Find autocorrelation peaks
      const peaks: { lag: number; r: number }[] = [];
      let prevR = -Infinity;
      let prevPrevR = -Infinity;
      for (let lag = minLag; lag <= Math.min(maxLag, frameSize - 1); lag++) {
        let numerator = 0, d1 = 0, d2 = 0;
        for (let i = 0; i < frameSize - lag; i++) {
          numerator += windowed[i] * windowed[i + lag];
          d1 += windowed[i] * windowed[i];
          d2 += windowed[i + lag] * windowed[i + lag];
        }
        const denom = Math.sqrt(d1 * d2);
        const r = denom > 0 ? numerator / denom : 0;
        // Detect local maxima
        if (prevR > prevPrevR && prevR > r && prevR > 0) {
          // Parabolic interpolation for sub-sample accuracy
          const denom2 = prevPrevR - 2 * prevR + r;
          let refinedLag = lag - 1;
          if (denom2 !== 0) {
            const delta = 0.5 * (prevPrevR - r) / denom2;
            refinedLag = (lag - 1) + delta;
          }
          peaks.push({ lag: refinedLag, r: prevR });
        }
        prevPrevR = prevR;
        prevR = r;
      }
      // Also check last value
      if (prevR > prevPrevR && prevR > 0) {
        peaks.push({ lag: Math.min(maxLag, frameSize - 1), r: prevR });
      }

      // Sort by strength descending, take top candidates
      peaks.sort((a, b) => b.r - a.r);
      const maxVoiced = ps.maxCandidates - 1;
      for (let i = 0; i < Math.min(peaks.length, maxVoiced); i++) {
        const freq = sampleRate / peaks[i].lag;
        // Apply octave cost: favour higher frequencies
        const strength = peaks[i].r - ps.octaveCost * Math.log2(ps.minHz / freq);
        candidates.push({ frequency: freq, strength });
      }
    }

    frameCandidates.push(candidates);
  }

  // Step 2: Viterbi path finding
  const nFrames = times.length;
  if (nFrames === 0) return { times: [], frequencies: [] };

  // Cost arrays: cost[frame][candidateIndex]
  const cost: number[][] = new Array(nFrames);
  const backpointer: number[][] = new Array(nFrames);

  // Initialize first frame
  cost[0] = frameCandidates[0].map(() => 0);
  backpointer[0] = frameCandidates[0].map(() => -1);

  // Time-step correction factor for transition costs (as per Praat article)
  const stepCorrection = 0.01 / timeStep;

  for (let f = 1; f < nFrames; f++) {
    const curr = frameCandidates[f];
    const prev = frameCandidates[f - 1];
    cost[f] = new Array(curr.length);
    backpointer[f] = new Array(curr.length);

    for (let c = 0; c < curr.length; c++) {
      let bestCost = Infinity;
      let bestPrev = 0;

      for (let p = 0; p < prev.length; p++) {
        let transitionCost = 0;
        const prevIsVoiced = prev[p].frequency > 0;
        const currIsVoiced = curr[c].frequency > 0;

        if (prevIsVoiced !== currIsVoiced) {
          // Voiced/unvoiced transition
          transitionCost += ps.voicedUnvoicedCost * stepCorrection;
        } else if (prevIsVoiced && currIsVoiced) {
          // Octave jump cost
          transitionCost += ps.octaveJumpCost * stepCorrection *
            Math.abs(Math.log2(curr[c].frequency / prev[p].frequency));
        }

        const totalCost = cost[f - 1][p] + transitionCost;
        if (totalCost < bestCost) {
          bestCost = totalCost;
          bestPrev = p;
        }
      }

      // Local cost: negative strength (we minimize cost)
      cost[f][c] = bestCost - curr[c].strength;
      backpointer[f][c] = bestPrev;
    }
  }

  // Trace back
  const bestPath: number[] = new Array(nFrames);
  let minCost = Infinity;
  let minIdx = 0;
  for (let c = 0; c < frameCandidates[nFrames - 1].length; c++) {
    if (cost[nFrames - 1][c] < minCost) {
      minCost = cost[nFrames - 1][c];
      minIdx = c;
    }
  }
  bestPath[nFrames - 1] = minIdx;
  for (let f = nFrames - 2; f >= 0; f--) {
    bestPath[f] = backpointer[f + 1][bestPath[f + 1]];
  }

  // Extract frequencies from best path
  const frequencies: Array<number | null> = bestPath.map((ci, fi) => {
    const cand = frameCandidates[fi][ci];
    return cand.frequency > 0 ? cand.frequency : null;
  });

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

  const hopMs = (hopSize / sampleRate) * 1000;
  const smoothingWindow = Math.max(1, Math.round(resolved.formant.smoothingWindowMs / hopMs)) | 1;
  const tracked = trackFormants(frames, resolved.formant.numberOfFormants, {
    transitionCostWeight: resolved.formant.transitionCostWeight,
    smoothingWindow,
    medianFilterSize: resolved.formant.medianFilterSize,
  });
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
    const meanSquare = energy / frameSize;
    values.push(meanSquare > 0 ? 10 * Math.log10(meanSquare / 4e-10) : -100);
    times.push((start + frameSize / 2) / sampleRate);
  }

  return { times, values };
}
