import type { FormantFrame } from '../types';

function transitionCost(prev: number, current: number): number {
  const delta = Math.abs(current - prev);
  return delta * 0.005 + Math.abs(Math.log((current + 1) / (prev + 1)));
}

function smoothTrack(values: Array<number | null>): Array<number | null> {
  return values.map((value, index) => {
    if (value === null) return null;
    let sum = value;
    let weight = 1;
    for (let offset = 1; offset <= 1; offset++) {
      const left = values[index - offset];
      const right = values[index + offset];
      if (left !== undefined && left !== null) {
        sum += left * 0.5;
        weight += 0.5;
      }
      if (right !== undefined && right !== null) {
        sum += right * 0.5;
        weight += 0.5;
      }
    }
    return sum / weight;
  });
}

function trackSingleFormant(frames: FormantFrame[], expectedHz: number): Array<number | null> {
  const states: number[][] = frames.map((frame) => frame.candidates);
  const costs: number[][] = states.map((state) => new Array(state.length).fill(Number.POSITIVE_INFINITY));
  const backPointers: number[][] = states.map((state) => new Array(state.length).fill(-1));

  for (let i = 0; i < states[0]?.length; i++) {
    costs[0][i] = Math.abs(states[0][i] - expectedHz) / expectedHz;
  }

  for (let frameIndex = 1; frameIndex < states.length; frameIndex++) {
    for (let candidateIndex = 0; candidateIndex < states[frameIndex].length; candidateIndex++) {
      const candidate = states[frameIndex][candidateIndex];
      const emission = Math.abs(candidate - expectedHz) / Math.max(expectedHz, 1);
      for (let prevIndex = 0; prevIndex < states[frameIndex - 1].length; prevIndex++) {
        const prev = states[frameIndex - 1][prevIndex];
        const cost = costs[frameIndex - 1][prevIndex] + emission + transitionCost(prev, candidate);
        if (cost < costs[frameIndex][candidateIndex]) {
          costs[frameIndex][candidateIndex] = cost;
          backPointers[frameIndex][candidateIndex] = prevIndex;
        }
      }
    }
  }

  const track = new Array<number | null>(frames.length).fill(null);
  if (frames.length === 0 || states.some((state) => state.length === 0)) {
    return track;
  }

  let bestIndex = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  const finalFrameCosts = costs[costs.length - 1];
  for (let i = 0; i < finalFrameCosts.length; i++) {
    if (finalFrameCosts[i] < bestCost) {
      bestCost = finalFrameCosts[i];
      bestIndex = i;
    }
  }

  for (let frameIndex = frames.length - 1; frameIndex >= 0; frameIndex--) {
    track[frameIndex] = states[frameIndex][bestIndex] ?? null;
    bestIndex = backPointers[frameIndex][bestIndex];
    if (bestIndex < 0 && frameIndex > 0) {
      break;
    }
  }

  return smoothTrack(track);
}

export function trackFormants(frames: FormantFrame[], numberOfFormants = 3): Array<Array<number | null>> {
  const expected = [500, 1500, 2500];
  const tracks: Array<Array<number | null>> = [];
  for (let i = 0; i < numberOfFormants; i++) {
    tracks.push(trackSingleFormant(frames, expected[i] ?? expected[expected.length - 1]));
  }
  return tracks;
}
