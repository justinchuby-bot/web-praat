/**
 * PointProcess — Glottal Closure Instant (GCI) detection.
 *
 * Detects glottal pulses using autocorrelation-based peak picking.
 * For each pitch period, finds the point of maximum amplitude (positive peak)
 * which corresponds to the glottal closure instant.
 */

export interface PointProcessData {
  /** Times (seconds) of detected glottal pulses */
  times: number[];
  /** Number of detected points */
  count: number;
}

export interface PointProcessSettings {
  /** Minimum pitch (Hz), default 75 */
  pitchFloor: number;
  /** Maximum pitch (Hz), default 500 */
  pitchCeiling: number;
  /** Silence threshold (relative to global max), default 0.03 */
  silenceThreshold: number;
  /** Voicing threshold for autocorrelation, default 0.45 */
  voicingThreshold: number;
}

export const defaultPointProcessSettings: PointProcessSettings = {
  pitchFloor: 75,
  pitchCeiling: 500,
  silenceThreshold: 0.03,
  voicingThreshold: 0.45,
};

/**
 * Compute PointProcess (periodic zero crossings / peak picking method).
 * Uses autocorrelation to determine local pitch period, then picks
 * the highest peak within each period as the GCI.
 */
export function computePointProcess(
  samples: Float32Array,
  sampleRate: number,
  settings?: Partial<PointProcessSettings>
): PointProcessData {
  const s = { ...defaultPointProcessSettings, ...settings };
  const minLag = Math.round(sampleRate / s.pitchCeiling);
  const maxLag = Math.round(sampleRate / s.pitchFloor);

  // Find global max amplitude for silence threshold
  let globalMax = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > globalMax) globalMax = abs;
  }
  const silenceLevel = globalMax * s.silenceThreshold;

  const times: number[] = [];
  const frameSize = maxLag * 3; // window large enough for autocorrelation
  const hopSize = Math.round(maxLag * 0.75);

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    // Check if frame is silent
    let frameMax = 0;
    for (let i = start; i < start + frameSize; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > frameMax) frameMax = abs;
    }
    if (frameMax < silenceLevel) continue;

    // Compute autocorrelation to find pitch period
    let bestLag = 0;
    let bestR = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let num = 0;
      let d1 = 0;
      let d2 = 0;
      const len = frameSize - lag;
      for (let i = 0; i < len; i++) {
        const idx = start + i;
        num += samples[idx] * samples[idx + lag];
        d1 += samples[idx] * samples[idx];
        d2 += samples[idx + lag] * samples[idx + lag];
      }
      const denom = Math.sqrt(d1 * d2);
      const r = denom > 0 ? num / denom : 0;
      if (r > bestR) {
        bestR = r;
        bestLag = lag;
      }
    }

    // Skip unvoiced frames
    if (bestR < s.voicingThreshold || bestLag === 0) continue;

    // Pick peaks within this frame at intervals of bestLag
    // Find the highest positive peak in each period
    const periodStart = start;
    const periodEnd = Math.min(start + frameSize, samples.length);

    for (let p = periodStart; p + bestLag <= periodEnd; p += bestLag) {
      let peakIdx = p;
      let peakVal = samples[p];
      const searchEnd = Math.min(p + bestLag, samples.length);
      for (let i = p; i < searchEnd; i++) {
        if (samples[i] > peakVal) {
          peakVal = samples[i];
          peakIdx = i;
        }
      }
      if (peakVal > silenceLevel) {
        const time = peakIdx / sampleRate;
        // Avoid duplicates (within half a pitch period)
        const minDist = bestLag / (2 * sampleRate);
        if (times.length === 0 || time - times[times.length - 1] > minDist) {
          times.push(time);
        }
      }
    }
  }

  return { times, count: times.length };
}
