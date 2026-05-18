import type { VoiceQualityMetrics } from '../types';

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function averageAbsoluteDifference(values: number[], radius: number): number {
  if (values.length <= radius * 2) return 0;
  let sum = 0;
  let count = 0;
  for (let i = radius; i < values.length - radius; i++) {
    let localSum = 0;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i) continue;
      localSum += values[j];
    }
    const localMean = localSum / (radius * 2);
    sum += Math.abs(values[i] - localMean);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

function computeDerivative(signal: Float32Array): Float32Array {
  const derivative = new Float32Array(signal.length);
  derivative[0] = 0;
  for (let i = 1; i < signal.length; i++) {
    derivative[i] = signal[i] - signal[i - 1];
  }
  return derivative;
}

function pickPulsePeaks(
  _signal: Float32Array,
  derivative: Float32Array,
  sampleRate: number,
  minHz = 75,
  maxHz = 500
): number[] {
  const absoluteDiff = new Float32Array(derivative.length);
  let maxValue = 0;
  for (let i = 0; i < derivative.length; i++) {
    absoluteDiff[i] = Math.abs(derivative[i]);
    maxValue = Math.max(maxValue, absoluteDiff[i]);
  }

  const minDistance = Math.max(1, Math.floor(sampleRate / maxHz));
  const maxDistance = Math.max(minDistance + 1, Math.ceil(sampleRate / minHz));
  const threshold = maxValue * 0.2;
  const pulses: number[] = [];
  let lastAccepted = -maxDistance;

  for (let i = 1; i < absoluteDiff.length - 1; i++) {
    const isPeak =
      absoluteDiff[i] > threshold &&
      absoluteDiff[i] >= absoluteDiff[i - 1] &&
      absoluteDiff[i] > absoluteDiff[i + 1];
    if (!isPeak) continue;
    if (i - lastAccepted < minDistance) {
      if (pulses.length > 0 && absoluteDiff[i] > absoluteDiff[pulses[pulses.length - 1]]) {
        pulses[pulses.length - 1] = i;
        lastAccepted = i;
      }
      continue;
    }
    if (i - lastAccepted > maxDistance * 2 && pulses.length > 0) {
      lastAccepted = i;
    }
    pulses.push(i);
    lastAccepted = i;
  }

  return pulses;
}

function pulseAmplitudes(signal: Float32Array, pulses: number[], windowRadius: number): number[] {
  return pulses.map((pulse) => {
    let maxAmplitude = 0;
    const start = Math.max(0, pulse - windowRadius);
    const end = Math.min(signal.length - 1, pulse + windowRadius);
    for (let i = start; i <= end; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(signal[i]));
    }
    return maxAmplitude;
  });
}

export function computeVoiceQuality(
  samples: Float32Array,
  sampleRate: number
): VoiceQualityMetrics {
  const derivative = computeDerivative(samples);
  const pulses = pickPulsePeaks(samples, derivative, sampleRate);
  const periodDurations: number[] = [];
  for (let i = 1; i < pulses.length; i++) {
    periodDurations.push((pulses[i] - pulses[i - 1]) / sampleRate);
  }
  const pulseAmps = pulseAmplitudes(samples, pulses, Math.max(1, Math.floor(sampleRate * 0.002)));

  const meanPeriod = mean(periodDurations);
  const meanAmp = mean(pulseAmps);

  const jitterDiffs = periodDurations.slice(1).map((period, index) => Math.abs(period - periodDurations[index]));
  const shimmerDiffs = pulseAmps.slice(1).map((amp, index) => Math.abs(amp - pulseAmps[index]));
  const shimmerDbDiffs = pulseAmps
    .slice(1)
    .map((amp, index) => 20 * Math.abs(Math.log10(Math.max(amp, 1e-6) / Math.max(pulseAmps[index], 1e-6))));

  return {
    pulses: pulses.map((pulse) => pulse / sampleRate),
    periodDurations,
    pulseAmplitudes: pulseAmps,
    jitterLocalPercent: meanPeriod > 0 ? (100 * mean(jitterDiffs)) / meanPeriod : 0,
    jitterAbsolute: mean(jitterDiffs),
    rap: meanPeriod > 0 ? averageAbsoluteDifference(periodDurations, 1) / meanPeriod : 0,
    ppq5: meanPeriod > 0 ? averageAbsoluteDifference(periodDurations, 2) / meanPeriod : 0,
    shimmerLocalPercent: meanAmp > 0 ? (100 * mean(shimmerDiffs)) / meanAmp : 0,
    shimmerDb: mean(shimmerDbDiffs),
    apq3: meanAmp > 0 ? averageAbsoluteDifference(pulseAmps, 1) / meanAmp : 0,
    apq5: meanAmp > 0 ? averageAbsoluteDifference(pulseAmps, 2) / meanAmp : 0,
  };
}
