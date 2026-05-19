/**
 * JavaScript API exposed to user scripts in the sandbox.
 * The `praat` object gives access to audio analysis functions.
 */

import { computePitch, computeFormants } from '../audio/analyzer';
import { computeHarmonicity } from '../audio/harmonicity';
import { computeLtas } from '../audio/ltas';
import { reduceNoise, preEmphasis, removeSilence } from '../audio/soundEnhance';
import { applyButterworthFilter } from '../audio/filters';
import type { PitchData, FormantData } from '../types';

export interface JsApiContext {
  samples: Float32Array;
  sampleRate: number;
  files?: Array<{ name: string; samples: Float32Array; sampleRate: number }>;
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
          maxFormant: options?.maxFormant ?? 5500,
          numFormants: options?.numFormants ?? 5,
          windowLength: 0.025,
          preEmphasis: 50,
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
  };

  return api;
}
