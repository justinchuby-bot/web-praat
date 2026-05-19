import { describe, it, expect } from 'vitest';
import { loadAudio } from '../src/mcp/audioLoader';
import { computePitch, computeFormants, computeIntensity } from '../src/audio/analyzer';
import { computeHarmonicity } from '../src/audio/harmonicity';
import { computeVoiceQuality } from '../src/audio/voiceQuality';
import { computeSpectrumSlice } from '../src/audio/spectrum';
import { generateIpaAnnotations } from '../src/audio/ipaVowels';
import { runPraatScript } from '../src/scripting/interpreter';
import { runJavaScript } from '../src/scripting/jsRunner';
import { defaultAnalysisSettings } from '../src/audio/defaults';

// Generate a test sine wave WAV in memory
function createTestWavBase64(freq = 220, duration = 0.5, sampleRate = 16000): string {
  const numSamples = Math.floor(duration * sampleRate);
  const dataSize = numSamples * 2; // 16-bit PCM
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * freq * i / sampleRate);
    buffer.writeInt16LE(Math.round(sample * 32767 * 0.8), 44 + i * 2);
  }

  return buffer.toString('base64');
}

describe('MCP audioLoader', () => {
  it('loads base64 WAV correctly', () => {
    const base64 = createTestWavBase64(440, 0.1, 16000);
    const audio = loadAudio({ base64 });
    expect(audio.sampleRate).toBe(16000);
    expect(audio.samples.length).toBe(1600);
    expect(audio.channels).toBe(1);
  });

  it('throws on invalid input', () => {
    expect(() => loadAudio({})).toThrow('Either filePath or base64 must be provided');
  });

  it('throws on non-WAV data', () => {
    const bad = Buffer.from('not a wav file').toString('base64');
    expect(() => loadAudio({ base64: bad })).toThrow('Not a valid WAV file');
  });
});

describe('MCP tool handlers', () => {
  const base64 = createTestWavBase64(220, 0.5, 16000);
  const audio = loadAudio({ base64 });

  it('analyze_pitch returns valid data', () => {
    const pitch = computePitch(audio.samples, audio.sampleRate, defaultAnalysisSettings);
    expect(pitch.times.length).toBeGreaterThan(0);
    expect(pitch.frequencies.length).toBe(pitch.times.length);
    // Should detect ~220Hz for sine wave
    const voiced = pitch.frequencies.filter((f): f is number => f !== null);
    if (voiced.length > 0) {
      const mean = voiced.reduce((a, b) => a + b, 0) / voiced.length;
      expect(mean).toBeGreaterThan(180);
      expect(mean).toBeLessThan(260);
    }
  });

  it('analyze_formants returns F1-F3 arrays', () => {
    const formants = computeFormants(audio.samples, audio.sampleRate, defaultAnalysisSettings);
    expect(formants.times.length).toBeGreaterThan(0);
    expect(formants.f1.length).toBe(formants.times.length);
    expect(formants.f2.length).toBe(formants.times.length);
    expect(formants.f3.length).toBe(formants.times.length);
  });

  it('analyze_intensity returns values', () => {
    const intensity = computeIntensity(audio.samples, audio.sampleRate);
    expect(intensity.times.length).toBeGreaterThan(0);
    expect(intensity.values.length).toBe(intensity.times.length);
  });

  it('analyze_harmonicity returns HNR data', () => {
    const harmonicity = computeHarmonicity(audio.samples, audio.sampleRate);
    expect(harmonicity.times.length).toBeGreaterThan(0);
    expect(typeof harmonicity.meanHnrDb).toBe('number');
  });

  it('analyze_voice_quality returns jitter/shimmer', () => {
    const vq = computeVoiceQuality(audio.samples, audio.sampleRate);
    expect(typeof vq.jitterLocalPercent).toBe('number');
    expect(typeof vq.shimmerLocalPercent).toBe('number');
  });

  it('get_spectrum returns frequency data', () => {
    const spectrum = computeSpectrumSlice(audio.samples, audio.sampleRate, 0.25, defaultAnalysisSettings);
    expect(spectrum.fftFrequencies.length).toBeGreaterThan(0);
    expect(spectrum.fftMagnitudes.length).toBe(spectrum.fftFrequencies.length);
  });

  it('detect_vowels runs without error', () => {
    const formants = computeFormants(audio.samples, audio.sampleRate, defaultAnalysisSettings);
    const intensity = computeIntensity(audio.samples, audio.sampleRate);
    const annotations = generateIpaAnnotations(
      formants.times, formants.f1, formants.f2, intensity.values
    );
    expect(Array.isArray(annotations)).toBe(true);
  });
});

describe('MCP scripting tools', () => {
  it('run_praat_script returns output', () => {
    const result = runPraatScript('writeInfoLine: "hello world"');
    expect(result.output).toContain('hello world');
    expect(result.errors.length).toBe(0);
  });

  it('run_js_script returns output', () => {
    const result = runJavaScript(
      'praat.log("test output")',
      { samples: new Float32Array(100), sampleRate: 16000 }
    );
    expect(result.output).toContain('test output');
  });
});
