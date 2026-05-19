/**
 * FastTrack plugin — formant tracking with multiple candidate analyses.
 * Simplified version of the FastTrack Praat plugin by Santiago Barreda.
 *
 * Original: https://github.com/santiagobarreda/FastTrack
 * This implementation uses our built-in LPC formant engine to run
 * multiple analyses with different ceiling frequencies and picks the best.
 */

import { PluginManifest } from './types';

const script = `
# FastTrack - Formant Tracking
# Runs multiple formant analyses with different max formant settings
# and selects the smoothest track (lowest mean absolute deviation).

appendInfoLine: "=== FastTrack Formant Analysis ==="
appendInfoLine: ""

# Parameters (injected by plugin system)
lowestCeiling = 4500
highestCeiling = 6500
numSteps = 5
numFormants = 3
timeStep = 0.002

stepSize = (highestCeiling - lowestCeiling) / (numSteps - 1)

appendInfoLine: "Testing ", numSteps, " ceiling frequencies:"
appendInfoLine: "  Range: ", lowestCeiling, " - ", highestCeiling, " Hz"
appendInfoLine: "  Step size: ", fixed$(stepSize, 0), " Hz"
appendInfoLine: ""

bestCeiling = lowestCeiling
bestSmoothness = 999999

for step from 1 to numSteps
  ceiling = lowestCeiling + (step - 1) * stepSize
  
  To Formant (burg): timeStep, numFormants, ceiling, 0.025, 50
  
  # Measure smoothness (sum of frame-to-frame differences)
  smoothness = 0
  prevF1 = 0
  prevF2 = 0
  
  for t from 1 to 20
    time = t * 0.02
    f1 = Get value at time: 1, time, "Hertz", "Linear"
    f2 = Get value at time: 2, time, "Hertz", "Linear"
    
    if prevF1 > 0 and f1 > 0
      smoothness = smoothness + abs(f1 - prevF1) + abs(f2 - prevF2)
    endif
    
    prevF1 = f1
    prevF2 = f2
  endfor
  
  appendInfoLine: "  Ceiling ", fixed$(ceiling, 0), " Hz → smoothness = ", fixed$(smoothness, 1)
  
  if smoothness < bestSmoothness
    bestSmoothness = smoothness
    bestCeiling = ceiling
  endif
endfor

appendInfoLine: ""
appendInfoLine: "✓ Best ceiling: ", fixed$(bestCeiling, 0), " Hz (smoothness: ", fixed$(bestSmoothness, 1), ")"
appendInfoLine: ""

# Final analysis with best ceiling
To Formant (burg): timeStep, numFormants, bestCeiling, 0.025, 50

appendInfoLine: "Final formant values (best ceiling):"
appendInfoLine: "Time (s)    F1 (Hz)    F2 (Hz)    F3 (Hz)"
appendInfoLine: "--------    -------    -------    -------"

for t from 1 to 10
  time = t * 0.04
  f1 = Get value at time: 1, time, "Hertz", "Linear"
  f2 = Get value at time: 2, time, "Hertz", "Linear"
  f3 = Get value at time: 3, time, "Hertz", "Linear"
  appendInfoLine: fixed$(time, 3), "       ", fixed$(f1, 0), "       ", fixed$(f2, 0), "       ", fixed$(f3, 0)
endfor

appendInfoLine: ""
appendInfoLine: "Done! Use the optimal ceiling (", fixed$(bestCeiling, 0), " Hz) for this speaker."
`;

export const fastTrackPlugin: PluginManifest = {
  id: 'fasttrack',
  name: 'FastTrack',
  version: '1.0.0',
  author: 'Santiago Barreda (adapted for web-praat)',
  description: 'Automatic formant tracking — tests multiple ceiling frequencies and picks the smoothest result.',
  category: 'formant',
  parameters: [
    { name: 'lowestCeiling', label: 'Lowest Ceiling (Hz)', type: 'number', default: 4500, min: 3000, max: 6000, step: 100 },
    { name: 'highestCeiling', label: 'Highest Ceiling (Hz)', type: 'number', default: 6500, min: 5000, max: 8000, step: 100 },
    { name: 'numSteps', label: 'Number of Steps', type: 'number', default: 5, min: 3, max: 20, step: 1 },
    { name: 'numFormants', label: 'Number of Formants', type: 'number', default: 3, min: 2, max: 5, step: 1 },
    { name: 'timeStep', label: 'Time Step (s)', type: 'number', default: 0.002, min: 0.001, max: 0.01, step: 0.001 },
  ],
  script,
};
