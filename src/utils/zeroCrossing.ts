/**
 * Find the nearest zero crossing to a given time in the audio samples.
 * Returns the interpolated time of the zero crossing.
 */
export function findNearestZeroCrossing(
  samples: Float32Array,
  sampleRate: number,
  time: number
): number {
  const centerIndex = Math.round(time * sampleRate);
  if (centerIndex < 0 || centerIndex >= samples.length) return time;

  // Search outward from center for a zero crossing
  const maxSearch = Math.min(1000, samples.length);
  let bestIndex = -1;
  let bestDist = Infinity;

  for (let offset = 0; offset < maxSearch; offset++) {
    for (const dir of [1, -1]) {
      const i = centerIndex + offset * dir;
      if (i < 0 || i >= samples.length - 1) continue;
      if (samples[i] * samples[i + 1] <= 0) {
        const dist = Math.abs(i - centerIndex);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
    }
    if (bestIndex !== -1 && offset > bestDist) break;
  }

  if (bestIndex === -1) return time;

  // Interpolate exact zero crossing between bestIndex and bestIndex+1
  const s0 = samples[bestIndex];
  const s1 = samples[bestIndex + 1];
  const frac = s0 === s1 ? 0 : Math.abs(s0) / (Math.abs(s0) + Math.abs(s1));
  return (bestIndex + frac) / sampleRate;
}
