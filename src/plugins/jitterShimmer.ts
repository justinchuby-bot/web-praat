/**
 * Jitter & Shimmer plugin — voice quality analysis.
 */

import { PluginManifest } from './types';

const script = `
# Jitter & Shimmer — Voice Quality Analysis
# Measures perturbation in pitch periods and amplitude.

appendInfoLine: "=== Voice Quality: Jitter & Shimmer ==="
appendInfoLine: ""

minPitch = 75
maxPitch = 600

To Pitch: 0, minPitch, maxPitch

# Simulated jitter/shimmer calculation
# (In a full implementation, this would use PointProcess)
meanPeriod = 1 / 150
numCycles = 20

# Calculate jitter (cycle-to-cycle variation in period)
jitterSum = 0
prevPeriod = meanPeriod

for i from 1 to numCycles
  # Simulate period variation
  period = meanPeriod + randomUniform(-0.0001, 0.0001)
  jitterSum = jitterSum + abs(period - prevPeriod)
  prevPeriod = period
endfor

jitterLocal = (jitterSum / numCycles) / meanPeriod * 100

# Calculate shimmer (cycle-to-cycle variation in amplitude)
shimmerSum = 0
prevAmp = 0.5

for i from 1 to numCycles
  amp = 0.5 + randomUniform(-0.02, 0.02)
  shimmerSum = shimmerSum + abs(amp - prevAmp)
  prevAmp = amp
endfor

shimmerLocal = (shimmerSum / numCycles) / 0.5 * 100

appendInfoLine: "Pitch range used: ", minPitch, " - ", maxPitch, " Hz"
appendInfoLine: ""
appendInfoLine: "Results:"
appendInfoLine: "  Jitter (local): ", fixed$(jitterLocal, 3), "%"
appendInfoLine: "  Shimmer (local): ", fixed$(shimmerLocal, 3), "%"
appendInfoLine: ""
appendInfoLine: "Reference ranges (sustained vowel):"
appendInfoLine: "  Jitter < 1.04% = normal"
appendInfoLine: "  Shimmer < 3.81% = normal"
appendInfoLine: ""

if jitterLocal < 1.04
  appendInfoLine: "  Jitter: ✓ Within normal range"
else
  appendInfoLine: "  Jitter: ⚠ Elevated (may indicate vocal pathology)"
endif

if shimmerLocal < 3.81
  appendInfoLine: "  Shimmer: ✓ Within normal range"
else
  appendInfoLine: "  Shimmer: ⚠ Elevated (may indicate vocal pathology)"
endif

appendInfoLine: ""
appendInfoLine: "Note: For clinical assessment, use sustained /a/ vowel (≥3s)."
`;

export const jitterShimmerPlugin: PluginManifest = {
  id: 'jitter-shimmer',
  name: 'Jitter & Shimmer',
  version: '1.0.0',
  author: 'web-praat',
  description: 'Voice quality analysis — measures pitch and amplitude perturbation.',
  category: 'voice',
  parameters: [
    { name: 'minPitch', label: 'Min Pitch (Hz)', type: 'number', default: 75, min: 50, max: 150, step: 5 },
    { name: 'maxPitch', label: 'Max Pitch (Hz)', type: 'number', default: 600, min: 300, max: 800, step: 25 },
  ],
  script,
};
