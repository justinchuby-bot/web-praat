/**
 * Sound manipulation utilities: extract, concatenate, reverse, scale, fade.
 */

export interface SoundBuffer {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Extract a portion of the buffer between start and end (in seconds).
 * Optionally apply a window function.
 */
export function extractPart(
  buf: SoundBuffer,
  startTime: number,
  endTime: number,
  window?: 'hanning' | 'hamming' | 'rectangular'
): SoundBuffer {
  if (startTime > endTime) throw new Error('start must be <= end');
  const startIdx = Math.max(0, Math.floor(startTime * buf.sampleRate));
  const endIdx = Math.min(buf.samples.length, Math.ceil(endTime * buf.sampleRate));
  const samples = buf.samples.slice(startIdx, endIdx) as Float32Array;

  if (window === 'hanning') {
    for (let i = 0; i < samples.length; i++) {
      samples[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1)));
    }
  } else if (window === 'hamming') {
    for (let i = 0; i < samples.length; i++) {
      samples[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (samples.length - 1));
    }
  }

  return { samples, sampleRate: buf.sampleRate };
}

/**
 * Concatenate multiple buffers. Optional overlapSeconds for crossfade.
 */
export function concatenate(parts: SoundBuffer[], overlapSeconds = 0): SoundBuffer {
  if (parts.length === 0) throw new Error('Cannot concatenate empty array');
  const sampleRate = parts[0].sampleRate;
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].sampleRate !== sampleRate) {
      throw new Error(`Mismatched sample rate: expected ${sampleRate}, got ${parts[i].sampleRate}`);
    }
  }

  if (parts.length === 1) return { samples: Float32Array.from(parts[0].samples), sampleRate };

  const overlapSamples = Math.round(overlapSeconds * sampleRate);
  const totalLength = parts.reduce((sum, p) => sum + p.samples.length, 0) - overlapSamples * (parts.length - 1);
  const result = new Float32Array(totalLength);

  let offset = 0;
  for (let p = 0; p < parts.length; p++) {
    const samples = parts[p].samples;
    if (p === 0) {
      result.set(samples, 0);
      offset = samples.length - overlapSamples;
    } else {
      // Crossfade in overlap region
      for (let i = 0; i < overlapSamples && i < samples.length; i++) {
        const fadeOut = 1 - i / overlapSamples;
        const fadeIn = i / overlapSamples;
        result[offset + i] = result[offset + i] * fadeOut + samples[i] * fadeIn;
      }
      // Copy rest
      for (let i = overlapSamples; i < samples.length; i++) {
        result[offset + i] = samples[i];
      }
      offset += samples.length - overlapSamples;
    }
  }

  return { samples: result, sampleRate };
}

/**
 * Reverse a buffer (or a sub-region by sample indices).
 */
export function reverse(buf: SoundBuffer, startIdx?: number, endIdx?: number): SoundBuffer {
  const samples = Float32Array.from(buf.samples);
  const s = startIdx ?? 0;
  const e = endIdx ?? samples.length;
  // Reverse in-place between s and e (exclusive)
  let left = s;
  let right = e - 1;
  while (left < right) {
    const tmp = samples[left];
    samples[left] = samples[right];
    samples[right] = tmp;
    left++;
    right--;
  }
  return { samples, sampleRate: buf.sampleRate };
}

/**
 * Scale amplitude by factor. If no factor given, normalize to peak 1.0.
 */
export function scaleAmplitude(buf: SoundBuffer, factor?: number): SoundBuffer {
  const samples = Float32Array.from(buf.samples);
  if (factor == null) {
    // Normalize
    let max = 0;
    for (let i = 0; i < samples.length; i++) {
      max = Math.max(max, Math.abs(samples[i]));
    }
    if (max === 0) return { samples, sampleRate: buf.sampleRate };
    factor = 1.0 / max;
  }
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.max(-1, Math.min(1, samples[i] * factor));
  }
  return { samples, sampleRate: buf.sampleRate };
}

/**
 * Apply linear fade-in over durationSeconds from the start.
 */
export function fadeIn(buf: SoundBuffer, durationSeconds: number): SoundBuffer {
  const samples = Float32Array.from(buf.samples);
  const len = Math.min(Math.round(durationSeconds * buf.sampleRate), samples.length);
  for (let i = 0; i < len; i++) {
    samples[i] *= i / len;
  }
  return { samples, sampleRate: buf.sampleRate };
}

/**
 * Apply linear fade-out over durationSeconds at the end.
 */
export function fadeOut(buf: SoundBuffer, durationSeconds: number): SoundBuffer {
  const samples = Float32Array.from(buf.samples);
  const len = Math.min(Math.round(durationSeconds * buf.sampleRate), samples.length);
  for (let i = 0; i < len; i++) {
    samples[samples.length - 1 - i] *= i / len;
  }
  return { samples, sampleRate: buf.sampleRate };
}

/**
 * Normalize audio to peak amplitude 0.99.
 */
export function normalize(samples: Float32Array): Float32Array {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    max = Math.max(max, Math.abs(samples[i]));
  }
  if (max === 0) return new Float32Array(samples.length);
  const factor = 0.99 / max;
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] * factor;
  }
  return result;
}

/**
 * Extract a selection as a plain Float32Array.
 */
export function extractSelection(
  samples: Float32Array,
  sampleRate: number,
  start: number,
  end: number
): Float32Array {
  const startIdx = Math.max(0, Math.floor(start * sampleRate));
  const endIdx = Math.min(samples.length, Math.ceil(end * sampleRate));
  return samples.slice(startIdx, endIdx) as Float32Array;
}
