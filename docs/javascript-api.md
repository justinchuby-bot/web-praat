# Web Praat — JavaScript Scripting API

Web Praat supports two scripting languages:
- **Praat Script** — for users migrating from desktop Praat
- **JavaScript** — for new users who prefer a familiar language

Both share the same underlying audio analysis engine.

## Quick Start

Open **Tools → Script Editor**, switch to the **JavaScript** tab, and write:

```javascript
// Analyze pitch of the loaded audio
const pitch = praat.toPitch(praat.audio, { minPitch: 75, maxPitch: 600 });
const meanF0 = praat.getMean(pitch);
praat.log(`Mean F0 = ${meanF0.toFixed(1)} Hz`);
```

Click **Run** to execute.

## API Reference

### Audio Access

| Property | Type | Description |
|----------|------|-------------|
| `praat.audio` | `Float32Array` | Current loaded audio samples |
| `praat.sampleRate` | `number` | Sample rate (e.g. 44100) |
| `praat.files` | `Array` | List of loaded files (for batch processing) |

### Pitch Analysis

```javascript
// Detect pitch (F0)
const pitch = praat.toPitch(samples, {
  minPitch: 75,      // Hz (default: 75)
  maxPitch: 600,     // Hz (default: 600)
  timestep: 0.01     // seconds (default: auto)
});

// Get statistics
const mean = praat.getMean(pitch);           // mean F0 in Hz
const value = praat.getValueAtTime(pitch, 0.5); // F0 at t=0.5s
```

### Formant Analysis

```javascript
// Detect formants
const formants = praat.toFormant(samples, {
  maxFormant: 5500,  // Hz (default: 5500)
  numFormants: 5,    // number of formants (default: 5)
  windowLength: 0.025
});

// Get specific formant value
const f1 = praat.getFormantValue(formants, 1, 0.5); // F1 at t=0.5s
const f2 = praat.getFormantValue(formants, 2, 0.5); // F2 at t=0.5s
```

### Filtering

```javascript
// Low-pass filter
const filtered = praat.filter(samples, {
  type: 'lowpass',   // 'lowpass' | 'highpass' | 'bandpass' | 'notch'
  cutoff: 1000,      // Hz
  order: 4           // filter order (default: 2)
});

// For bandpass, specify both cutoffs:
const band = praat.filter(samples, {
  type: 'bandpass',
  cutoff: 300,
  cutoffHigh: 3000
});
```

### Sound Enhancement

```javascript
// Pre-emphasis (boost high frequencies)
const emphasized = praat.preEmphasis(samples, 0.97);

// Noise reduction (spectral subtraction)
const clean = praat.reduceNoise(samples);

// Remove silence
const trimmed = praat.removeSilence(samples, {
  threshold: 0.02,   // RMS threshold
  minDuration: 0.3   // minimum silence duration to remove (seconds)
});
```

### Spectral Analysis

```javascript
// Long-Term Average Spectrum
const ltas = praat.ltas(samples);

// Harmonicity (HNR)
const hnr = praat.harmonicity(samples);
```

### Output

```javascript
praat.log("Hello");                    // print to output panel
praat.log("F0:", mean, "Hz");          // multiple args
praat.log(`Formants: F1=${f1}, F2=${f2}`); // template literals
```

## Migration from Praat Script

### Example 1: Get Mean Pitch

**Praat Script:**
```praat
To Pitch: 0, 75, 600
Get mean: 0, 0, "Hertz"
appendInfoLine: "Mean F0 = ", self, " Hz"
```

**JavaScript:**
```javascript
const pitch = praat.toPitch(praat.audio, { minPitch: 75, maxPitch: 600 });
praat.log(`Mean F0 = ${praat.getMean(pitch)} Hz`);
```

### Example 2: Extract Formants

**Praat Script:**
```praat
To Formant (burg): 0, 5, 5500, 0.025, 50
Get value at time: 1, 0.5, "Hertz", "Linear"
appendInfoLine: "F1 at 0.5s = ", self, " Hz"
```

**JavaScript:**
```javascript
const formants = praat.toFormant(praat.audio, { maxFormant: 5500 });
const f1 = praat.getFormantValue(formants, 1, 0.5);
praat.log(`F1 at 0.5s = ${f1} Hz`);
```

### Example 3: Batch Processing

**Praat Script:**
```praat
for file from 1 to numberOfFiles
    Read from file: file$(file)
    To Pitch: 0, 75, 600
    mean = Get mean: 0, 0, "Hertz"
    appendInfoLine: file$(file), ": ", mean, " Hz"
    Remove
endfor
```

**JavaScript:**
```javascript
for (const file of praat.files) {
  const pitch = praat.toPitch(file.samples, { minPitch: 75, maxPitch: 600 });
  praat.log(`${file.name}: ${praat.getMean(pitch)} Hz`);
}
```

### Example 4: Filter + Analyze

**Praat Script:**
```praat
Filter (pass Hann band): 0, 1000, 100
To Pitch: 0, 75, 600
mean = Get mean: 0, 0, "Hertz"
```

**JavaScript:**
```javascript
const filtered = praat.filter(praat.audio, { type: 'lowpass', cutoff: 1000 });
const pitch = praat.toPitch(filtered, { minPitch: 75, maxPitch: 600 });
praat.log(`Mean F0 (filtered) = ${praat.getMean(pitch)} Hz`);
```

## Sandbox Security

JavaScript runs in a sandboxed environment. The following are **not available**:
- `window`, `document`, `globalThis`
- `fetch`, `XMLHttpRequest`
- `eval`, `Function`
- File system access
- Network access

Only the `praat.*` API is available for interacting with audio data.

## Tips

- Use `praat.log()` liberally — it's your debugger
- Chain operations: filter → analyze → log results
- All analysis functions accept raw `Float32Array` samples
- Sample rate is always available via `praat.sampleRate`
- Results are plain numbers/arrays — use standard JS to process them
