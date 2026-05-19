/**
 * Vowel Space plugin — plots F1/F2 vowel space from formant analysis.
 */

import { PluginManifest } from './types';

const script = `
# Vowel Space Analysis
# Extracts F1/F2 at regular intervals and reports vowel space metrics.

appendInfoLine: "=== Vowel Space Analysis ==="
appendInfoLine: ""

numFormants = 5
maxFormant = 5500
timeStep = 0.01

To Formant (burg): timeStep, numFormants, maxFormant, 0.025, 50

# Collect F1/F2 values
numPoints = 0
sumF1 = 0
sumF2 = 0
minF1 = 9999
maxF1 = 0
minF2 = 9999
maxF2 = 0

for t from 1 to 50
  time = t * 0.01
  f1 = Get value at time: 1, time, "Hertz", "Linear"
  f2 = Get value at time: 2, time, "Hertz", "Linear"
  
  if f1 > 100 and f1 < 1200 and f2 > 500 and f2 < 3500
    numPoints = numPoints + 1
    sumF1 = sumF1 + f1
    sumF2 = sumF2 + f2
    if f1 < minF1
      minF1 = f1
    endif
    if f1 > maxF1
      maxF1 = f1
    endif
    if f2 < minF2
      minF2 = f2
    endif
    if f2 > maxF2
      maxF2 = f2
    endif
  endif
endfor

if numPoints > 0
  meanF1 = sumF1 / numPoints
  meanF2 = sumF2 / numPoints
  
  appendInfoLine: "Valid measurement points: ", numPoints
  appendInfoLine: ""
  appendInfoLine: "F1 (vowel height — higher F1 = more open):"
  appendInfoLine: "  Mean: ", fixed$(meanF1, 0), " Hz"
  appendInfoLine: "  Range: ", fixed$(minF1, 0), " - ", fixed$(maxF1, 0), " Hz"
  appendInfoLine: ""
  appendInfoLine: "F2 (vowel frontness — higher F2 = more front):"
  appendInfoLine: "  Mean: ", fixed$(meanF2, 0), " Hz"
  appendInfoLine: "  Range: ", fixed$(minF2, 0), " - ", fixed$(maxF2, 0), " Hz"
  appendInfoLine: ""
  appendInfoLine: "Estimated vowel region:"
  if meanF1 < 400
    if meanF2 > 2000
      appendInfoLine: "  → High front (close to /i/)"
    elsif meanF2 < 1000
      appendInfoLine: "  → High back (close to /u/)"
    else
      appendInfoLine: "  → High central"
    endif
  elsif meanF1 > 700
    if meanF2 > 1500
      appendInfoLine: "  → Low front (close to /æ/ or /a/)"
    else
      appendInfoLine: "  → Low back (close to /ɑ/ or /ɒ/)"
    endif
  else
    if meanF2 > 1800
      appendInfoLine: "  → Mid front (close to /e/ or /ɛ/)"
    elsif meanF2 < 1000
      appendInfoLine: "  → Mid back (close to /o/ or /ɔ/)"
    else
      appendInfoLine: "  → Mid central (close to /ə/)"
    endif
  endif
else
  appendInfoLine: "No valid formant measurements found."
  appendInfoLine: "Make sure audio contains voiced speech."
endif

appendInfoLine: ""
appendInfoLine: "Done!"
`;

export const vowelSpacePlugin: PluginManifest = {
  id: 'vowel-space',
  name: 'Vowel Space',
  version: '1.0.0',
  author: 'web-praat',
  description: 'Analyzes F1/F2 to determine vowel position in the vowel space.',
  category: 'formant',
  parameters: [
    { name: 'maxFormant', label: 'Max Formant (Hz)', type: 'number', default: 5500, min: 4000, max: 7000, step: 100 },
    { name: 'numFormants', label: 'Number of Formants', type: 'number', default: 5, min: 3, max: 6, step: 1 },
  ],
  script,
};
