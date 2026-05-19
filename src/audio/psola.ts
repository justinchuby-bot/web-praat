/**
 * PSOLA (Pitch-Synchronous Overlap-Add) resynthesis engine.
 *
 * Given an audio signal and pitch marks, resynthesize with modified pitch
 * and/or duration by repositioning and overlap-adding pitch-synchronous
 * analysis frames.
 */

export interface PitchPoint {
  time: number; // seconds
  frequency: number; // Hz (0 = unvoiced)
}

export interface DurationPoint {
  time: number; // seconds (original time axis)
  factor: number; // >1 = stretch, <1 = compress
}

export interface ManipulationState {
  sampleRate: number;
  originalSamples: Float32Array;
  pitchTier: PitchPoint[];
  durationTier: DurationPoint[];
}

/**
 * Detect pitch marks (glottal closure instants) using autocorrelation.
 * Returns array of sample indices for each pitch period boundary.
 */
export function detectPitchMarks(
  samples: Float32Array,
  sampleRate: number,
  minF0 = 75,
  maxF0 = 600
): number[] {
  const minPeriod = Math.floor(sampleRate / maxF0);
  const maxPeriod = Math.ceil(sampleRate / minF0);
  const marks: number[] = [];
  const frameLen = maxPeriod * 2;

  let pos = 0;
  while (pos < samples.length - frameLen) {
    // Autocorrelation to find local pitch period
    let bestLag = minPeriod;
    let bestCorr = -Infinity;

    for (let lag = minPeriod; lag <= maxPeriod && pos + lag + frameLen < samples.length; lag++) {
      let corr = 0;
      let energy1 = 0;
      let energy2 = 0;
      for (let i = 0; i < frameLen; i++) {
        corr += samples[pos + i] * samples[pos + i + lag];
        energy1 += samples[pos + i] * samples[pos + i];
        energy2 += samples[pos + i + lag] * samples[pos + i + lag];
      }
      const norm = Math.sqrt(energy1 * energy2);
      if (norm > 0) corr /= norm;
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    marks.push(pos);
    // Advance by detected period
    pos += bestCorr > 0.3 ? bestLag : maxPeriod;
  }

  return marks;
}

/**
 * Interpolate pitch tier to get frequency at a given time.
 */
export function interpolatePitch(pitchTier: PitchPoint[], time: number): number {
  if (pitchTier.length === 0) return 0;
  if (pitchTier.length === 1) return pitchTier[0].frequency;
  if (time <= pitchTier[0].time) return pitchTier[0].frequency;
  if (time >= pitchTier[pitchTier.length - 1].time) return pitchTier[pitchTier.length - 1].frequency;

  // Find surrounding points
  for (let i = 0; i < pitchTier.length - 1; i++) {
    if (time >= pitchTier[i].time && time <= pitchTier[i + 1].time) {
      const t = (time - pitchTier[i].time) / (pitchTier[i + 1].time - pitchTier[i].time);
      return pitchTier[i].frequency * (1 - t) + pitchTier[i + 1].frequency * t;
    }
  }
  return pitchTier[pitchTier.length - 1].frequency;
}

/**
 * Compute duration mapping: original time → new time using duration tier.
 */
export function mapDuration(durationTier: DurationPoint[], _originalDuration: number, originalTime: number): number {
  if (durationTier.length === 0) return originalTime;

  // Integrate the duration factor from 0 to originalTime
  // Sort tier by time
  const sorted = [...durationTier].sort((a, b) => a.time - b.time);

  let newTime = 0;
  let prevTime = 0;
  let prevFactor = sorted.length > 0 ? sorted[0].factor : 1;

  for (const point of sorted) {
    if (point.time >= originalTime) {
      // Interpolate up to originalTime
      newTime += (originalTime - prevTime) * prevFactor;
      return newTime;
    }
    newTime += (point.time - prevTime) * prevFactor;
    prevTime = point.time;
    prevFactor = point.factor;
  }

  // Beyond last duration point
  newTime += (originalTime - prevTime) * prevFactor;
  return newTime;
}

/**
 * Hanning window function.
 */
function hanning(n: number, N: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
}

/**
 * PSOLA resynthesis: modify pitch and duration of audio.
 */
export function psolaResynthesize(state: ManipulationState): Float32Array {
  const { sampleRate, originalSamples, pitchTier, durationTier } = state;

  // Step 1: Detect pitch marks in original
  const pitchMarks = detectPitchMarks(originalSamples, sampleRate);
  if (pitchMarks.length < 2) {
    return new Float32Array(originalSamples); // Can't process
  }

  // Step 2: Compute output duration
  const originalDuration = originalSamples.length / sampleRate;
  const outputDuration = mapDuration(durationTier, originalDuration, originalDuration);
  const outputLength = Math.ceil(outputDuration * sampleRate);
  const output = new Float32Array(outputLength);

  // Step 3: Place synthesis marks according to new pitch
  const synthMarks: number[] = [];
  let synthPos = 0;
  while (synthPos < outputLength) {
    synthMarks.push(synthPos);
    const synthTime = synthPos / sampleRate;
    const freq = interpolatePitch(pitchTier, synthTime);
    const period = freq > 0 ? Math.round(sampleRate / freq) : Math.round(sampleRate / 100);
    synthPos += period;
  }

  // Step 4: For each synthesis mark, find closest analysis mark and OLA
  for (const synthMark of synthMarks) {
    const synthTime = synthMark / sampleRate;

    // Map synthesis time back to original time (inverse duration mapping)
    // Simple approximation: find original time that maps to synthTime
    let origTime = synthTime; // Default
    if (durationTier.length > 0) {
      // Binary search for original time
      let lo = 0, hi = originalDuration;
      for (let iter = 0; iter < 20; iter++) {
        const mid = (lo + hi) / 2;
        const mapped = mapDuration(durationTier, originalDuration, mid);
        if (mapped < synthTime) lo = mid;
        else hi = mid;
      }
      origTime = (lo + hi) / 2;
    }

    // Find closest pitch mark in original
    const origSample = Math.round(origTime * sampleRate);
    let closestMark = pitchMarks[0];
    let closestDist = Math.abs(pitchMarks[0] - origSample);
    for (const mark of pitchMarks) {
      const dist = Math.abs(mark - origSample);
      if (dist < closestDist) {
        closestDist = dist;
        closestMark = mark;
      }
    }

    // Determine window size (2 periods)
    const freq = interpolatePitch(pitchTier, synthTime);
    const period = freq > 0 ? Math.round(sampleRate / freq) : Math.round(sampleRate / 100);
    const windowSize = period * 2;
    const halfWindow = windowSize >> 1;

    // Extract and window the analysis frame
    for (let i = -halfWindow; i < halfWindow; i++) {
      const srcIdx = closestMark + i;
      const dstIdx = synthMark + i;
      if (srcIdx >= 0 && srcIdx < originalSamples.length && dstIdx >= 0 && dstIdx < outputLength) {
        const w = hanning(i + halfWindow, windowSize);
        output[dstIdx] += originalSamples[srcIdx] * w;
      }
    }
  }

  // Normalize to prevent clipping
  let maxAbs = 0;
  for (let i = 0; i < output.length; i++) {
    const abs = Math.abs(output[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs > 1) {
    for (let i = 0; i < output.length; i++) {
      output[i] /= maxAbs;
    }
  }

  return output;
}

/**
 * Generate a synthetic pitched signal for testing.
 */
export function generateSineWave(frequency: number, duration: number, sampleRate: number): Float32Array {
  const length = Math.round(duration * sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  return samples;
}
