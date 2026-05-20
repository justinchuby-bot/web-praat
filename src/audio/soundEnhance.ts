/**
 * Sound Enhancement module
 * - Noise reduction (spectral subtraction)
 * - Pre-emphasis
 * - Remove silence
 */

export interface NoiseReductionOptions {
  /** Duration in seconds of the initial silence used to estimate noise spectrum */
  noiseDuration?: number;
  /** FFT frame size (must be power of 2) */
  frameSize?: number;
  /** Hop size between frames */
  hopSize?: number;
  /** Over-subtraction factor (>1 for more aggressive noise removal) */
  subtraction?: number;
  /** Spectral floor to prevent musical noise (0-1) */
  spectralFloor?: number;
}

export interface PreEmphasisOptions {
  /** Pre-emphasis coefficient α (0-1, typically 0.95-0.97) */
  alpha?: number;
}

export interface RemoveSilenceOptions {
  /** RMS threshold below which a frame is considered silence */
  threshold?: number;
  /** Minimum silence duration in seconds to trigger removal */
  minSilenceDuration?: number;
  /** Frame size for RMS calculation */
  frameSize?: number;
  /** Keep a small padding around non-silent segments (seconds) */
  padding?: number;
}

// ─── Noise Reduction (Spectral Subtraction) ────────────────────────────────

function hann(n: number, N: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
}

function fftReal(frame: Float32Array): { re: Float32Array; im: Float32Array } {
  const N = frame.length;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  // DFT (simple radix-2 would be better but correctness first)
  for (let k = 0; k < N; k++) {
    let sumRe = 0;
    let sumIm = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      sumRe += frame[n] * Math.cos(angle);
      sumIm -= frame[n] * Math.sin(angle);
    }
    re[k] = sumRe;
    im[k] = sumIm;
  }
  return { re, im };
}

function ifftReal(re: Float32Array, im: Float32Array): Float32Array {
  const N = re.length;
  const output = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let k = 0; k < N; k++) {
      const angle = (2 * Math.PI * k * n) / N;
      sum += re[k] * Math.cos(angle) + im[k] * Math.sin(angle);
    }
    output[n] = sum / N;
  }
  return output;
}

export function reduceNoise(
  samples: Float32Array,
  sampleRate: number,
  options: NoiseReductionOptions = {}
): Float32Array {
  const {
    noiseDuration = 0.5,
    frameSize = 1024,
    hopSize = 256,
    subtraction = 2,
    spectralFloor = 0.01,
  } = options;

  const noiseSamples = Math.min(
    Math.floor(noiseDuration * sampleRate),
    samples.length
  );

  // Estimate noise spectrum from initial silence
  const noiseSpectrum = new Float32Array(frameSize);
  let noiseFrameCount = 0;

  for (let start = 0; start + frameSize <= noiseSamples; start += hopSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i] * hann(i, frameSize);
    }
    const { re, im } = fftReal(frame);
    for (let k = 0; k < frameSize; k++) {
      noiseSpectrum[k] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }
    noiseFrameCount++;
  }

  if (noiseFrameCount > 0) {
    for (let k = 0; k < frameSize; k++) {
      noiseSpectrum[k] /= noiseFrameCount;
    }
  }

  // Process full signal with overlap-add
  const output = new Float32Array(samples.length);
  const windowSum = new Float32Array(samples.length);

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i] * hann(i, frameSize);
    }

    const { re, im } = fftReal(frame);

    // Spectral subtraction
    for (let k = 0; k < frameSize; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const phase = Math.atan2(im[k], re[k]);
      const cleanMag = Math.max(
        mag - subtraction * noiseSpectrum[k],
        spectralFloor * mag
      );
      re[k] = cleanMag * Math.cos(phase);
      im[k] = cleanMag * Math.sin(phase);
    }

    const reconstructed = ifftReal(re, im);

    for (let i = 0; i < frameSize; i++) {
      const w = hann(i, frameSize);
      output[start + i] += reconstructed[i] * w;
      windowSum[start + i] += w * w;
    }
  }

  // Normalize by window sum
  for (let i = 0; i < output.length; i++) {
    if (windowSum[i] > 1e-8) {
      output[i] /= windowSum[i];
    }
  }

  return output;
}

/**
 * GPU-accelerated noise reduction using WebGPU FFT when available.
 * Same algorithm as reduceNoise but async with GPU FFT path.
 */
export async function reduceNoiseAsync(
  samples: Float32Array,
  sampleRate: number,
  options: NoiseReductionOptions = {}
): Promise<Float32Array> {
  const { fftComplexAuto } = await import('../utils/fft-adapter');

  const {
    noiseDuration = 0.5,
    frameSize = 1024,
    hopSize = 256,
    subtraction = 2,
    spectralFloor = 0.01,
  } = options;

  const noiseSamples = Math.min(Math.floor(noiseDuration * sampleRate), samples.length);

  // Estimate noise spectrum
  const noiseSpectrum = new Float32Array(frameSize);
  let noiseFrameCount = 0;

  for (let start = 0; start + frameSize <= noiseSamples; start += hopSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) frame[i] = samples[start + i] * hann(i, frameSize);
    const { re, im } = await fftComplexAuto(frame, frameSize);
    for (let k = 0; k < frameSize; k++) noiseSpectrum[k] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    noiseFrameCount++;
  }

  if (noiseFrameCount > 0) {
    for (let k = 0; k < frameSize; k++) noiseSpectrum[k] /= noiseFrameCount;
  }

  // Process full signal with overlap-add
  const output = new Float32Array(samples.length);
  const windowSum = new Float32Array(samples.length);

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) frame[i] = samples[start + i] * hann(i, frameSize);

    const { re, im } = await fftComplexAuto(frame, frameSize);

    // Spectral subtraction
    for (let k = 0; k < frameSize; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const phase = Math.atan2(im[k], re[k]);
      const cleanMag = Math.max(mag - subtraction * noiseSpectrum[k], spectralFloor * mag);
      re[k] = cleanMag * Math.cos(phase);
      im[k] = cleanMag * Math.sin(phase);
    }

    // IFFT (CPU — GPU IFFT not yet implemented)
    const reconstructed = ifftReal(re, im);
    for (let i = 0; i < frameSize; i++) {
      output[start + i] += reconstructed[i] * hann(i, frameSize);
      windowSum[start + i] += hann(i, frameSize) * hann(i, frameSize);
    }
  }

  for (let i = 0; i < output.length; i++) {
    if (windowSum[i] > 1e-8) output[i] /= windowSum[i];
  }

  return output;
}

export function preEmphasis(
  samples: Float32Array,
  options: PreEmphasisOptions = {}
): Float32Array {
  const { alpha = 0.97 } = options;
  const output = new Float32Array(samples.length);
  output[0] = samples[0];
  for (let n = 1; n < samples.length; n++) {
    output[n] = samples[n] - alpha * samples[n - 1];
  }
  return output;
}

// ─── Remove Silence ─────────────────────────────────────────────────────────

export function removeSilence(
  samples: Float32Array,
  sampleRate: number,
  options: RemoveSilenceOptions = {}
): Float32Array {
  const {
    threshold = 0.01,
    minSilenceDuration = 0.1,
    frameSize = 1024,
    padding = 0.02,
  } = options;

  const minSilenceFrames = Math.ceil(
    (minSilenceDuration * sampleRate) / frameSize
  );
  const paddingSamples = Math.floor(padding * sampleRate);

  // Calculate RMS per frame
  const numFrames = Math.floor(samples.length / frameSize);
  const isSilent = new Array<boolean>(numFrames);

  for (let f = 0; f < numFrames; f++) {
    let sumSq = 0;
    const start = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const s = samples[start + i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    isSilent[f] = rms < threshold;
  }

  // Find silent regions long enough to remove
  const keepRanges: Array<[number, number]> = [];
  let nonSilentStart = -1;

  for (let f = 0; f <= numFrames; f++) {
    const silent = f === numFrames || isSilent[f];
    if (!silent && nonSilentStart === -1) {
      nonSilentStart = f;
    } else if (silent && nonSilentStart !== -1) {
      // Check if this silent run is long enough
      let silentRun = 0;
      let ff = f;
      while (ff < numFrames && isSilent[ff]) {
        silentRun++;
        ff++;
      }
      if (silentRun >= minSilenceFrames || f === numFrames) {
        // End current non-silent region
        const startSample = Math.max(0, nonSilentStart * frameSize - paddingSamples);
        const endSample = Math.min(samples.length, f * frameSize + paddingSamples);
        keepRanges.push([startSample, endSample]);
        nonSilentStart = -1;
      }
      // If silent run is short, continue the non-silent region
    }
  }

  // If no ranges found, return empty or original
  if (keepRanges.length === 0) {
    return new Float32Array(0);
  }

  // Concatenate kept ranges
  let totalLength = 0;
  for (const [start, end] of keepRanges) {
    totalLength += end - start;
  }

  const output = new Float32Array(totalLength);
  let offset = 0;
  for (const [start, end] of keepRanges) {
    output.set(samples.subarray(start, end), offset);
    offset += end - start;
  }

  return output;
}
