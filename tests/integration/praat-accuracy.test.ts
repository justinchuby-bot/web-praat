/**
 * Integration tests comparing our DSP output against Praat (via Parselmouth) reference data.
 * 
 * Tolerances:
 * - Pitch: ±2 Hz
 * - Formant: ±50 Hz
 * - Intensity: ±1 dB
 * - HNR: ±2 dB
 * 
 * If a test fails due to algorithm differences, mark as .todo() — do NOT modify fixtures.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeAudio } from '../../src/audio/analyzer';

// ─── WAV Loader ───────────────────────────────────────────────────────────────

function loadWav(relPath: string): { samples: Float32Array; sampleRate: number } {
  const buf = readFileSync(resolve(__dirname, '../../', relPath));
  // Parse WAV header (16-bit PCM mono)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  
  // Find 'fmt ' chunk
  let offset = 12; // skip RIFF header
  let sampleRate = 44100;
  let dataOffset = 0;
  let dataSize = 0;
  
  while (offset < buf.length - 8) {
    const chunkId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);
    
    if (chunkId === 'fmt ') {
      sampleRate = view.getUint32(offset + 12, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }
  
  const numSamples = dataSize / 2; // 16-bit = 2 bytes per sample
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
  }
  
  return { samples, sampleRate };
}

// ─── Reference Loader ─────────────────────────────────────────────────────────

function loadRef(relPath: string) {
  return JSON.parse(readFileSync(resolve(__dirname, '../../', relPath), 'utf-8'));
}

// ─── Sine 440Hz Tests ─────────────────────────────────────────────────────────

describe('Praat accuracy — sine 440Hz', () => {
  const { samples, sampleRate } = loadWav('fixtures/sine_440hz.wav');
  const result = analyzeAudio(samples, sampleRate);
  const pitchRef = loadRef('fixtures/sine_440hz_pitch.json');

  it('pitch within ±2 Hz of Praat', () => {
    // Compare at matching time points (our analysis may have different frame count)
    const ourTimes = result.pitch.times;
    const ourFreqs = result.pitch.frequencies;
    
    let compared = 0;
    for (let i = 0; i < pitchRef.frequencies.length; i++) {
      const refFreq = pitchRef.frequencies[i];
      if (refFreq === null) continue;
      
      // Find closest time in our result
      const refTime = pitchRef.times[i];
      const ourIdx = ourTimes.findIndex((t: number) => Math.abs(t - refTime) < 0.005);
      if (ourIdx === -1) continue;
      
      const ourFreq = ourFreqs[ourIdx];
      if (ourFreq === null) continue;
      
      expect(Math.abs(ourFreq - refFreq), 
        `at t=${refTime.toFixed(3)}: ours=${ourFreq.toFixed(1)} vs praat=${refFreq.toFixed(1)}`
      ).toBeLessThan(2);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('intensity within ±1 dB of Praat', () => {
    const intRef = loadRef('fixtures/sine_440hz_intensity.json');
    let compared = 0;
    for (let i = 0; i < intRef.values.length; i++) {
      const refVal = intRef.values[i];
      const refTime = intRef.times[i];
      const ourIdx = result.intensity.times.findIndex((t: number) => Math.abs(t - refTime) < 0.005);
      if (ourIdx === -1) continue;
      const ourVal = result.intensity.values[ourIdx];
      expect(Math.abs(ourVal - refVal),
        `intensity at t=${refTime.toFixed(3)}: ours=${ourVal.toFixed(1)} vs praat=${refVal.toFixed(1)}`
      ).toBeLessThan(1);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  // TODO: Our HNR values are much lower than Praat for pure sine (~21dB vs ~91dB).
  // Likely different autocorrelation normalization or window handling.
  it.todo('HNR within ±2 dB of Praat');
});

// ─── Vowel /a/ Tests ──────────────────────────────────────────────────────────

describe('Praat accuracy — vowel /a/', () => {
  const { samples, sampleRate } = loadWav('fixtures/vowel_a.wav');
  const result = analyzeAudio(samples, sampleRate);
  const pitchRef = loadRef('fixtures/vowel_a_pitch.json');

  it('pitch within ±2 Hz of Praat', () => {
    let compared = 0;
    for (let i = 0; i < pitchRef.frequencies.length; i++) {
      const refFreq = pitchRef.frequencies[i];
      if (refFreq === null) continue;
      
      const refTime = pitchRef.times[i];
      const ourIdx = result.pitch.times.findIndex((t: number) => Math.abs(t - refTime) < 0.005);
      if (ourIdx === -1) continue;
      
      const ourFreq = result.pitch.frequencies[ourIdx];
      if (ourFreq === null) continue;
      
      expect(Math.abs(ourFreq - refFreq),
        `pitch at t=${refTime.toFixed(3)}: ours=${ourFreq.toFixed(1)} vs praat=${refFreq.toFixed(1)}`
      ).toBeLessThan(2);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  // TODO: Formant extraction differs significantly from Praat (ours=773 vs Praat=1095 for F1).
  // Our LPC order/window settings likely differ from Praat's Burg method defaults.
  it.todo('F1 within ±50 Hz of Praat');

  // TODO: F2 also diverges heavily (ours=1214 vs Praat=2634).
  // Same root cause as F1 — LPC parameter mismatch.
  it.todo('F2 within ±50 Hz of Praat');

  it('intensity within ±1 dB of Praat', () => {
    const intRef = loadRef('fixtures/vowel_a_intensity.json');
    let compared = 0;
    for (let i = 0; i < intRef.values.length; i++) {
      const refVal = intRef.values[i];
      const refTime = intRef.times[i];
      const ourIdx = result.intensity.times.findIndex((t: number) => Math.abs(t - refTime) < 0.005);
      if (ourIdx === -1) continue;
      const ourVal = result.intensity.values[ourIdx];
      expect(Math.abs(ourVal - refVal),
        `intensity at t=${refTime.toFixed(3)}: ours=${ourVal.toFixed(1)} vs praat=${refVal.toFixed(1)}`
      ).toBeLessThan(1);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  // TODO: Same HNR discrepancy as sine 440Hz.
  it.todo('HNR within ±2 dB of Praat');
});

// ─── Sweep Tests ──────────────────────────────────────────────────────────────

describe('Praat accuracy — frequency sweep', () => {
  const { samples, sampleRate } = loadWav('fixtures/sweep.wav');
  const result = analyzeAudio(samples, sampleRate);
  const pitchRef = loadRef('fixtures/sweep_pitch.json');

  // TODO: Sweep pitch barely exceeds tolerance (max diff ~2.1 Hz vs ±2 Hz limit).
  // Our autocorrelation is very close but not quite matching Praat on fast-changing pitch.
  it.todo('pitch tracks sweep within ±2 Hz of Praat');
});
