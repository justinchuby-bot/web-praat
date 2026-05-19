import type { PitchData, PitchTierPoint, DurationTierPoint } from '../types';

/**
 * Extract glottal pulse positions from pitch data.
 * Uses pitch period to place pulses at regular intervals within voiced regions.
 */
export function extractPulses(
  samples: Float32Array,
  sampleRate: number,
  pitchData: PitchData
): number[] {
  const pulses: number[] = [];
  const duration = samples.length / sampleRate;

  // Find voiced regions from pitch data
  for (let i = 0; i < pitchData.times.length; i++) {
    const freq = pitchData.frequencies[i];
    if (freq === null || freq <= 0) continue;

    const time = pitchData.times[i];
    if (time < 0 || time > duration) continue;

    // Place a pulse at each pitch period within this frame
    pulses.push(time);
  }

  // Refine pulses: for each approximate position, find the nearest peak
  const refined: number[] = [];
  for (const t of pulses) {
    const sample = Math.round(t * sampleRate);
    // Search within ±2ms for a peak
    const searchRadius = Math.round(0.002 * sampleRate);
    const lo = Math.max(0, sample - searchRadius);
    const hi = Math.min(samples.length - 1, sample + searchRadius);

    let maxIdx = sample;
    let maxVal = -Infinity;
    for (let j = lo; j <= hi; j++) {
      const absVal = Math.abs(samples[j]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxIdx = j;
      }
    }
    refined.push(maxIdx / sampleRate);
  }

  // Remove duplicates (pulses too close together)
  refined.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const t of refined) {
    if (deduped.length === 0 || t - deduped[deduped.length - 1] > 0.001) {
      deduped.push(t);
    }
  }

  return deduped;
}

/**
 * Interpolate pitch tier to get frequency at a given time.
 */
function interpolatePitchTier(tier: PitchTierPoint[], time: number): number | null {
  if (tier.length === 0) return null;
  if (tier.length === 1) return tier[0].frequency;
  if (time <= tier[0].time) return tier[0].frequency;
  if (time >= tier[tier.length - 1].time) return tier[tier.length - 1].frequency;

  for (let i = 0; i < tier.length - 1; i++) {
    if (time >= tier[i].time && time <= tier[i + 1].time) {
      const ratio = (time - tier[i].time) / (tier[i + 1].time - tier[i].time);
      return tier[i].frequency + ratio * (tier[i + 1].frequency - tier[i].frequency);
    }
  }
  return tier[tier.length - 1].frequency;
}

/**
 * Interpolate duration tier to get factor at a given time.
 */
function interpolateDurationTier(tier: DurationTierPoint[], time: number): number {
  if (tier.length === 0) return 1;
  if (tier.length === 1) return tier[0].factor;
  if (time <= tier[0].time) return tier[0].factor;
  if (time >= tier[tier.length - 1].time) return tier[tier.length - 1].factor;

  for (let i = 0; i < tier.length - 1; i++) {
    if (time >= tier[i].time && time <= tier[i + 1].time) {
      const ratio = (time - tier[i].time) / (tier[i + 1].time - tier[i].time);
      return tier[i].factor + ratio * (tier[i + 1].factor - tier[i].factor);
    }
  }
  return tier[tier.length - 1].factor;
}

/**
 * Build time mapping from output time to input time using duration tier.
 * Integration of 1/factor gives the mapping.
 */
function buildTimeMapping(
  inputDuration: number,
  durationTier: DurationTierPoint[],
  steps: number
): { outputDuration: number; outputToInput: (outputTime: number) => number } {
  // Numerically integrate factor to get output duration
  const dt = inputDuration / steps;
  const outputTimes: number[] = [0];
  const inputTimes: number[] = [0];

  let outputAccum = 0;
  for (let i = 0; i < steps; i++) {
    const inputTime = i * dt;
    const factor = interpolateDurationTier(durationTier, inputTime);
    outputAccum += dt * factor;
    outputTimes.push(outputAccum);
    inputTimes.push((i + 1) * dt);
  }

  const outputDuration = outputAccum;

  function outputToInput(outputTime: number): number {
    if (outputTime <= 0) return 0;
    if (outputTime >= outputDuration) return inputDuration;
    // Binary search
    let lo = 0;
    let hi = outputTimes.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (outputTimes[mid] <= outputTime) lo = mid;
      else hi = mid;
    }
    const ratio = (outputTime - outputTimes[lo]) / (outputTimes[hi] - outputTimes[lo]);
    return inputTimes[lo] + ratio * (inputTimes[hi] - inputTimes[lo]);
  }

  return { outputDuration, outputToInput };
}

/**
 * Find nearest pulse index to a given time.
 */
function findNearestPulse(pulses: number[], time: number): number {
  let best = 0;
  let bestDist = Math.abs(pulses[0] - time);
  for (let i = 1; i < pulses.length; i++) {
    const dist = Math.abs(pulses[i] - time);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * TD-PSOLA resynthesis with modified pitch and duration.
 */
export function synthesizePsola(
  samples: Float32Array,
  sampleRate: number,
  pulses: number[],
  pitchTier: PitchTierPoint[],
  durationTier: DurationTierPoint[]
): Float32Array {
  if (pulses.length === 0) {
    return new Float32Array(samples);
  }

  const inputDuration = samples.length / sampleRate;
  const { outputDuration, outputToInput } = buildTimeMapping(inputDuration, durationTier, 1000);
  const outputLength = Math.round(outputDuration * sampleRate);
  const output = new Float32Array(outputLength);

  // Generate output pulses based on target pitch
  const outputPulses: number[] = [];
  let t = pulses[0]; // Start at first input pulse mapped to output
  // Actually start from beginning
  t = 0.005; // small offset
  while (t < outputDuration) {
    outputPulses.push(t);
    const targetFreq = interpolatePitchTier(pitchTier, t);
    if (targetFreq && targetFreq > 0) {
      t += 1.0 / targetFreq;
    } else {
      t += 0.01; // unvoiced: 10ms hop
    }
  }

  // For each output pulse, synthesize via OLA
  for (const outTime of outputPulses) {
    const inTime = outputToInput(outTime);
    const pulseIdx = findNearestPulse(pulses, inTime);
    const pulseTime = pulses[pulseIdx];

    // Determine local period
    let localPeriod: number;
    if (pulseIdx > 0 && pulseIdx < pulses.length - 1) {
      localPeriod = (pulses[pulseIdx + 1] - pulses[pulseIdx - 1]) / 2;
    } else if (pulseIdx < pulses.length - 1) {
      localPeriod = pulses[pulseIdx + 1] - pulses[pulseIdx];
    } else if (pulseIdx > 0) {
      localPeriod = pulses[pulseIdx] - pulses[pulseIdx - 1];
    } else {
      localPeriod = 0.005;
    }

    // Window size: 2 periods
    const windowSamples = Math.round(2 * localPeriod * sampleRate);
    if (windowSamples < 4) continue;

    const pulseSample = Math.round(pulseTime * sampleRate);
    const outSample = Math.round(outTime * sampleRate);
    const halfWin = Math.floor(windowSamples / 2);

    for (let j = -halfWin; j <= halfWin; j++) {
      const inIdx = pulseSample + j;
      const outIdx = outSample + j;
      if (inIdx < 0 || inIdx >= samples.length) continue;
      if (outIdx < 0 || outIdx >= outputLength) continue;

      // Hanning window
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * (j + halfWin)) / windowSamples));
      output[outIdx] += samples[inIdx] * w;
    }
  }

  return output;
}
