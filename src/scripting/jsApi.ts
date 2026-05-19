/**
 * JavaScript API exposed to user scripts in the sandbox.
 * The `praat` object gives access to audio analysis functions.
 */

import { computePitch, computeFormants, computeIntensity, computeSpectrogram } from '../audio/analyzer';
import { computeHarmonicity } from '../audio/harmonicity';
import { computeLtas } from '../audio/ltas';
import { reduceNoise, preEmphasis, removeSilence } from '../audio/soundEnhance';
import { applyButterworthFilter } from '../audio/filters';
import { computeVoiceQuality } from '../audio/voiceQuality';
import { computePointProcess } from '../audio/pointprocess';
import { computeMfcc } from '../audio/mfcc';
import { fftInPlace, ifftInPlace } from '../utils/fft';
import type { PitchData, FormantData, IntensityData, SpectrogramData, TextGrid } from '../types';

export interface JsApiContext {
  samples: Float32Array;
  sampleRate: number;
  files?: Array<{ name: string; samples: Float32Array; sampleRate: number }>;
  textGrid?: TextGrid | null;
}

export interface JsApiResult {
  logs: string[];
  errors: Array<{ message: string }>;
}

export function createPraatApi(context: JsApiContext, result: JsApiResult) {
  const api = {
    // Properties
    get audio() {
      return context.samples;
    },
    get sampleRate() {
      return context.sampleRate;
    },
    get files() {
      return context.files ?? [];
    },

    // Pitch
    toPitch(
      audio?: Float32Array,
      options?: { minPitch?: number; maxPitch?: number }
    ): PitchData {
      const samples = audio ?? context.samples;
      return computePitch(samples, context.sampleRate, {
        pitch: {
          minHz: options?.minPitch ?? 75,
          maxHz: options?.maxPitch ?? 600,
          silenceThreshold: 0.03,
          voicingThreshold: 0.45,
          octaveCost: 0.01,
          octaveJumpCost: 0.35,
          voicedUnvoicedCost: 0.14,
          maxCandidates: 15,
        },
      });
    },

    // Formants
    toFormant(
      audio?: Float32Array,
      options?: { maxFormant?: number; numFormants?: number }
    ): FormantData {
      const samples = audio ?? context.samples;
      return computeFormants(samples, context.sampleRate, {
        formant: {
          maxFrequency: options?.maxFormant ?? 5500,
          numberOfFormants: options?.numFormants ?? 5,
          lpcOrder: 12,
          smoothingWindowMs: 20,
          transitionCostWeight: 1.0,
          medianFilterSize: 3,
        },
      });
    },

    // Get mean of pitch/data
    getMean(data: PitchData | FormantData | number[], start?: number, end?: number): number {
      let values: (number | null)[];
      if (Array.isArray(data)) {
        values = data;
      } else if ('frequencies' in data) {
        values = (data as PitchData).frequencies;
      } else if ('f1' in data) {
        values = (data as FormantData).f1;
      } else {
        return 0;
      }

      const startIdx = start ?? 0;
      const endIdx = end && end > 0 ? end : values.length;
      let sum = 0;
      let count = 0;
      for (let i = startIdx; i < endIdx && i < values.length; i++) {
        const v = values[i];
        if (v != null && isFinite(v)) {
          sum += v;
          count++;
        }
      }
      return count > 0 ? sum / count : 0;
    },

    // Get formant value at specific time
    getFormantValue(formantData: FormantData, formantNumber: number, time: number): number | null {
      const key = `f${formantNumber}` as keyof FormantData;
      const values = formantData[key] as (number | null)[] | undefined;
      if (!values || !formantData.times) return null;
      // Find closest time index
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < formantData.times.length; i++) {
        const dist = Math.abs(formantData.times[i] - time);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      return values[closestIdx] ?? null;
    },

    // Filter
    filter(
      audio?: Float32Array,
      options?: { type?: string; cutoff?: number; order?: number }
    ): Float32Array {
      const samples = audio ?? context.samples;
      const type = (options?.type ?? 'lowpass') as 'lowpass' | 'highpass' | 'bandpass';
      const cutoff = options?.cutoff ?? 1000;
      const order = options?.order ?? 4;
      return applyButterworthFilter(samples, context.sampleRate, type, cutoff, order);
    },

    // Pre-emphasis
    preEmphasis(audio?: Float32Array, alpha?: number): Float32Array {
      const samples = audio ?? context.samples;
      return preEmphasis(samples, { alpha: alpha ?? 0.97 });
    },

    // Noise reduction
    reduceNoise(audio?: Float32Array): Float32Array {
      const samples = audio ?? context.samples;
      return reduceNoise(samples, context.sampleRate);
    },

    // Remove silence
    removeSilence(audio?: Float32Array): Float32Array {
      const samples = audio ?? context.samples;
      return removeSilence(samples, context.sampleRate);
    },

    // LTAS
    ltas(audio?: Float32Array) {
      const samples = audio ?? context.samples;
      return computeLtas(samples, context.sampleRate);
    },

    // Harmonicity (HNR)
    harmonicity(audio?: Float32Array) {
      const samples = audio ?? context.samples;
      return computeHarmonicity(samples, context.sampleRate);
    },

    // Logging
    log(...args: unknown[]) {
      result.logs.push(args.map(a => String(a)).join(' '));
    },

    // Duration
    get duration() {
      return context.samples.length / context.sampleRate;
    },

    // Get min/max from pitch data
    getMin(data: PitchData | number[]): number {
      const values = Array.isArray(data) ? data : (data as PitchData).frequencies;
      let min = Infinity;
      for (const v of values) {
        if (v != null && isFinite(v) && v < min) min = v;
      }
      return min === Infinity ? 0 : min;
    },

    getMax(data: PitchData | number[]): number {
      const values = Array.isArray(data) ? data : (data as PitchData).frequencies;
      let max = -Infinity;
      for (const v of values) {
        if (v != null && isFinite(v) && v > max) max = v;
      }
      return max === -Infinity ? 0 : max;
    },

    // Intensity
    intensity(audio?: Float32Array): IntensityData {
      const samples = audio ?? context.samples;
      return computeIntensity(samples, context.sampleRate);
    },

    // Voice quality: jitter
    jitter(audio?: Float32Array): number {
      const samples = audio ?? context.samples;
      const vq = computeVoiceQuality(samples, context.sampleRate);
      return vq.jitterLocalPercent;
    },

    // Voice quality: shimmer
    shimmer(audio?: Float32Array): number {
      const samples = audio ?? context.samples;
      const vq = computeVoiceQuality(samples, context.sampleRate);
      return vq.shimmerLocalPercent;
    },

    // Point process (glottal pulses)
    pointProcess(audio?: Float32Array) {
      const samples = audio ?? context.samples;
      return computePointProcess(samples, context.sampleRate);
    },

    // Resample (linear interpolation)
    resample(audio: Float32Array | undefined, newRate: number): Float32Array {
      const samples = audio ?? context.samples;
      const ratio = newRate / context.sampleRate;
      const newLength = Math.round(samples.length * ratio);
      const out = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const srcIdx = i / ratio;
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, samples.length - 1);
        const frac = srcIdx - lo;
        out[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
      }
      return out;
    },

    // Reverse audio
    reverse(audio?: Float32Array): Float32Array {
      const samples = audio ?? context.samples;
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        out[i] = samples[samples.length - 1 - i];
      }
      return out;
    },

    // Spectrogram
    spectrogram(
      audio?: Float32Array,
      options?: { fftSize?: 256 | 512 | 1024 | 2048 | 4096; hopSize?: number; windowFunction?: 'hanning' | 'hamming' | 'gaussian' | 'bartlett' | 'rectangular' }
    ): SpectrogramData {
      const samples = audio ?? context.samples;
      return computeSpectrogram(samples, context.sampleRate, {
        spectrogram: {
          fftSize: options?.fftSize ?? 512,
          hopSize: options?.hopSize ?? 128,
          windowFunction: options?.windowFunction ?? 'gaussian',
          preEmphasis: 6,
          dynamicRangeDb: 70,
          colormap: 'jet',
          maxViewFrequency: context.sampleRate / 2,
        },
      });
    },

    // MFCC
    mfcc(
      audio?: Float32Array,
      options?: { numCoeffs?: number; fftSize?: number; hopSize?: number; numFilters?: number }
    ) {
      const samples = audio ?? context.samples;
      return computeMfcc(samples, context.sampleRate, options);
    },

    // FFT — returns { real, imag } arrays
    fft(audio?: Float32Array, size?: number) {
      const samples = audio ?? context.samples;
      const n = size ?? (function nextPow2(v: number) { let p = 1; while (p < v) p <<= 1; return p; })(samples.length);
      const re = new Float64Array(n);
      const im = new Float64Array(n);
      for (let i = 0; i < Math.min(samples.length, n); i++) re[i] = samples[i];
      fftInPlace(re, im);
      return { real: re, imag: im, length: n };
    },

    // IFFT — takes { real, imag } and returns Float32Array
    ifft(spectrum: { real: Float64Array; imag: Float64Array }): Float32Array {
      const re = Float64Array.from(spectrum.real);
      const im = Float64Array.from(spectrum.imag);
      ifftInPlace(re, im);
      const out = new Float32Array(re.length);
      for (let i = 0; i < re.length; i++) out[i] = re[i];
      return out;
    },

    // TextGrid access
    textGrid: {
      get data(): TextGrid | null {
        return context.textGrid ?? null;
      },
      getTierByName(name: string) {
        return context.textGrid?.tiers.find(t => t.name === name) ?? null;
      },
      getTierByIndex(index: number) {
        return context.textGrid?.tiers[index] ?? null;
      },
      get numTiers(): number {
        return context.textGrid?.tiers.length ?? 0;
      },
      getLabels(tierNameOrIndex: string | number): string[] {
        const tier = typeof tierNameOrIndex === 'string'
          ? context.textGrid?.tiers.find(t => t.name === tierNameOrIndex)
          : context.textGrid?.tiers[tierNameOrIndex];
        if (!tier) return [];
        if (tier.kind === 'interval') return tier.intervals.map(i => i.label);
        return tier.points.map(p => p.label);
      },
    },
  };

  return api;
}
