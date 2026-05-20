/**
 * Sound manipulation operations following Praat's Modify/Combine menus.
 *
 * All operations work on mono Float32Array samples + sampleRate.
 * They return new buffers (immutable style) to integrate with the editor's
 * undo/redo history.
 */

export interface SoundBuffer {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Extract a time range from a sound, optionally applying a window function.
 * Mirrors Praat's Sound_extractPart.
 */
export function extractPart(
  buf: SoundBuffer,
  tmin: number,
  tmax: number,
  windowShape: 'rectangular' | 'hanning' | 'hamming' | 'gaussian' = 'rectangular',
): SoundBuffer {
  if (tmin >= tmax) {
    throw new Error('extractPart: tmin must be less than tmax');
  }
  const { samples, sampleRate } = buf;
  const duration = samples.length / sampleRate;

  // Clamp to valid range
  const startTime = Math.max(0, tmin);
  const endTime = Math.min(duration, tmax);

  const startSample = Math.round(startTime * sampleRate);
  const endSample = Math.round(endTime * sampleRate);

  if (endSample <= startSample) {
    throw new Error('extractPart: extracted region contains no samples');
  }

  const extracted = new Float32Array(endSample - startSample);
  extracted.set(samples.slice(startSample, endSample));

  // Apply window
  applyWindow(extracted, windowShape);

  return { samples: extracted, sampleRate };
}

/**
 * Concatenate multiple sounds with optional overlap crossfade.
 * Mirrors Praat's Sounds_concatenate.
 * All buffers must share the same sample rate.
 */
export function concatenate(
  buffers: SoundBuffer[],
  overlapTime = 0,
): SoundBuffer {
  if (buffers.length === 0) {
    throw new Error('concatenate: no sounds provided');
  }
  if (buffers.length === 1) {
    return { samples: Float32Array.from(buffers[0].samples), sampleRate: buffers[0].sampleRate };
  }

  const sampleRate = buffers[0].sampleRate;
  for (const buf of buffers) {
    if (buf.sampleRate !== sampleRate) {
      throw new Error(
        'concatenate: all sounds must have the same sample rate. ' +
        `Expected ${sampleRate}, got ${buf.sampleRate}.`
      );
    }
  }

  const overlapSamples = Math.round(overlapTime * sampleRate);
  let totalLength = buffers.reduce((sum, b) => sum + b.samples.length, 0);
  totalLength -= overlapSamples * (buffers.length - 1);

  if (totalLength <= 0) {
    throw new Error('concatenate: overlap exceeds total duration');
  }

  const output = new Float32Array(totalLength);

  // Build crossfade smoother (raised cosine)
  let smoother: Float32Array | null = null;
  if (overlapSamples > 0) {
    smoother = new Float32Array(overlapSamples);
    for (let i = 0; i < overlapSamples; i++) {
      smoother[i] = 0.5 - 0.5 * Math.cos(Math.PI * (i + 0.5) / overlapSamples);
    }
  }

  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const src = buffers[i].samples;
    const isFirst = i === 0;
    const isLast = i === buffers.length - 1;
    const fadeInLen = isFirst ? 0 : overlapSamples;
    const fadeOutLen = isLast ? 0 : overlapSamples;

    if (overlapSamples > 0 && overlapSamples * 2 > src.length) {
      throw new Error('concatenate: a sound is shorter than twice the overlap time');
    }

    // Fade-in region: add with smoother weight
    for (let j = 0; j < fadeInLen; j++) {
      output[offset + j] += src[j] * smoother![j];
    }

    // Middle (copy directly)
    const midStart = fadeInLen;
    const midEnd = src.length - fadeOutLen;
    output.set(src.slice(midStart, midEnd), offset + midStart);

    // Fade-out region: write with inverse smoother
    for (let j = 0; j < fadeOutLen; j++) {
      const srcIdx = src.length - fadeOutLen + j;
      output[offset + srcIdx] = src[srcIdx] * smoother![overlapSamples - 1 - j];
    }

    offset += src.length - fadeOutLen;
  }

  return { samples: output, sampleRate };
}

/**
 * Reverse the samples in-place (returns new buffer).
 */
export function reverse(buf: SoundBuffer, tmin?: number, tmax?: number): SoundBuffer {
  const { samples, sampleRate } = buf;
  const result = Float32Array.from(samples);

  const startSample = tmin != null ? Math.max(0, Math.round(tmin * sampleRate)) : 0;
  const endSample = tmax != null ? Math.min(samples.length, Math.round(tmax * sampleRate)) : samples.length;

  // Reverse the specified region
  let left = startSample;
  let right = endSample - 1;
  while (left < right) {
    const tmp = result[left];
    result[left] = result[right];
    result[right] = tmp;
    left++;
    right--;
  }

  return { samples: result, sampleRate };
}

/**
 * Apply a linear fade-in over the given duration (from start of buffer or tmin).
 */
export function fadeIn(buf: SoundBuffer, duration: number, startTime = 0): SoundBuffer {
  const { samples, sampleRate } = buf;
  const result = Float32Array.from(samples);

  const startSample = Math.max(0, Math.round(startTime * sampleRate));
  const fadeSamples = Math.round(duration * sampleRate);
  const endSample = Math.min(samples.length, startSample + fadeSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / fadeSamples;
    result[i] *= t;
  }

  return { samples: result, sampleRate };
}

/**
 * Apply a linear fade-out over the given duration (ending at endTime or end of buffer).
 */
export function fadeOut(buf: SoundBuffer, duration: number, endTime?: number): SoundBuffer {
  const { samples, sampleRate } = buf;
  const result = Float32Array.from(samples);

  const end = endTime != null ? Math.min(samples.length, Math.round(endTime * sampleRate)) : samples.length;
  const fadeSamples = Math.round(duration * sampleRate);
  const start = Math.max(0, end - fadeSamples);

  for (let i = start; i < end; i++) {
    const t = (end - i) / fadeSamples;
    result[i] *= t;
  }

  return { samples: result, sampleRate };
}

/**
 * Scale the amplitude of a sound by a factor, or normalize to peak = 1.0.
 */
export function scaleAmplitude(buf: SoundBuffer, factor?: number): SoundBuffer {
  const { samples, sampleRate } = buf;
  const result = Float32Array.from(samples);

  let scale = factor;
  if (scale == null) {
    // Normalize: find peak
    let peak = 0;
    for (let i = 0; i < result.length; i++) {
      const abs = Math.abs(result[i]);
      if (abs > peak) peak = abs;
    }
    scale = peak > 0 ? 1.0 / peak : 1.0;
  }

  for (let i = 0; i < result.length; i++) {
    result[i] *= scale;
  }

  return { samples: result, sampleRate };
}

// --- Internal helpers ---

function applyWindow(samples: Float32Array, shape: string): void {
  const N = samples.length;
  if (shape === 'rectangular' || N <= 1) return;

  for (let i = 0; i < N; i++) {
    let w: number;
    switch (shape) {
      case 'hanning':
        w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        break;
      case 'hamming':
        w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
        break;
      case 'gaussian':
        {
          const sigma = 0.4;
          const x = (i - (N - 1) / 2) / (sigma * (N - 1) / 2);
          w = Math.exp(-0.5 * x * x);
        }
        break;
      default:
        w = 1;
    }
    samples[i] *= w;
  }
}
