#!/usr/bin/env node
/**
 * web-praat MCP Server — exposes speech analysis tools via MCP protocol.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadAudio } from './audioLoader.js';
import { computePitch, computeFormants, computeIntensity } from '../audio/analyzer.js';
import { computeHarmonicity } from '../audio/harmonicity.js';
import { computeVoiceQuality } from '../audio/voiceQuality.js';
import { computeSpectrumSlice } from '../audio/spectrum.js';
import { generateIpaAnnotations } from '../audio/ipaVowels.js';
import { runPraatScript } from '../scripting/interpreter.js';
import { runJavaScript } from '../scripting/jsRunner.js';
import { defaultAnalysisSettings } from '../audio/defaults.js';

const audioInputSchema = {
  filePath: z.string().optional().describe('Path to a WAV file'),
  base64: z.string().optional().describe('Base64-encoded WAV audio data'),
};

function getAudio(args: { filePath?: string; base64?: string }) {
  const { samples, sampleRate } = loadAudio(args);
  return { samples, sampleRate };
}

const server = new McpServer({
  name: 'web-praat',
  version: '0.1.0',
});

// --- analyze_pitch ---
server.tool(
  'analyze_pitch',
  'Analyze pitch (F0) of audio. Returns mean, min, max, and time series.',
  audioInputSchema,
  async (args) => {
    const { samples, sampleRate } = getAudio(args);
    const pitch = computePitch(samples, sampleRate, defaultAnalysisSettings);
    const voiced = pitch.frequencies.filter((f): f is number => f !== null);
    const mean = voiced.length > 0 ? voiced.reduce((a, b) => a + b, 0) / voiced.length : 0;
    const min = voiced.length > 0 ? Math.min(...voiced) : 0;
    const max = voiced.length > 0 ? Math.max(...voiced) : 0;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          mean, min, max,
          voicedFrames: voiced.length,
          totalFrames: pitch.frequencies.length,
          times: pitch.times,
          frequencies: pitch.frequencies,
        }, null, 2),
      }],
    };
  }
);

// --- analyze_formants ---
server.tool(
  'analyze_formants',
  'Analyze formants (F1-F3) of audio. Returns time series of formant frequencies.',
  audioInputSchema,
  async (args) => {
    const { samples, sampleRate } = getAudio(args);
    const formants = computeFormants(samples, sampleRate, defaultAnalysisSettings);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          times: formants.times,
          f1: formants.f1,
          f2: formants.f2,
          f3: formants.f3,
        }, null, 2),
      }],
    };
  }
);

// --- analyze_intensity ---
server.tool(
  'analyze_intensity',
  'Analyze intensity (loudness) of audio in dB.',
  audioInputSchema,
  async (args) => {
    const { samples, sampleRate } = getAudio(args);
    const intensity = computeIntensity(samples, sampleRate);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          times: intensity.times,
          values: intensity.values,
          mean: intensity.values.reduce((a, b) => a + b, 0) / intensity.values.length,
        }, null, 2),
      }],
    };
  }
);

// --- analyze_harmonicity ---
server.tool(
  'analyze_harmonicity',
  'Analyze harmonics-to-noise ratio (HNR) of audio.',
  audioInputSchema,
  async (args) => {
    const { samples, sampleRate } = getAudio(args);
    const harmonicity = computeHarmonicity(samples, sampleRate);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          times: harmonicity.times,
          values: harmonicity.values,
          meanHnrDb: harmonicity.meanHnrDb,
          medianHnrDb: harmonicity.medianHnrDb,
        }, null, 2),
      }],
    };
  }
);

// --- analyze_voice_quality ---
server.tool(
  'analyze_voice_quality',
  'Analyze voice quality: jitter (pitch perturbation) and shimmer (amplitude perturbation).',
  audioInputSchema,
  async (args) => {
    const { samples, sampleRate } = getAudio(args);
    const vq = computeVoiceQuality(samples, sampleRate);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          jitterLocalPercent: vq.jitterLocalPercent,
          jitterAbsolute: vq.jitterAbsolute,
          rap: vq.rap,
          ppq5: vq.ppq5,
          shimmerLocalPercent: vq.shimmerLocalPercent,
          shimmerDb: vq.shimmerDb,
          apq3: vq.apq3,
          apq5: vq.apq5,
          numberOfPulses: vq.pulses.length,
        }, null, 2),
      }],
    };
  }
);

// --- get_spectrum ---
server.tool(
  'get_spectrum',
  'Get frequency spectrum slice at a specific time point.',
  {
    ...audioInputSchema,
    time: z.number().describe('Time in seconds for the spectrum slice'),
  },
  async (args) => {
    const { samples, sampleRate } = getAudio(args);
    const spectrum = computeSpectrumSlice(samples, sampleRate, args.time, defaultAnalysisSettings);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          time: spectrum.time,
          frequencies: Array.from(spectrum.fftFrequencies),
          magnitudes: Array.from(spectrum.fftMagnitudes),
          lpcEnvelope: Array.from(spectrum.lpcEnvelope),
        }, null, 2),
      }],
    };
  }
);

// --- detect_vowels ---
server.tool(
  'detect_vowels',
  'Detect vowel segments in audio with IPA annotation.',
  audioInputSchema,
  async (args) => {
    const { samples, sampleRate } = getAudio(args);
    const formants = computeFormants(samples, sampleRate, defaultAnalysisSettings);
    const intensity = computeIntensity(samples, sampleRate);
    const annotations = generateIpaAnnotations(
      formants.times,
      formants.f1,
      formants.f2,
      intensity.values,
    );

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ annotations }, null, 2),
      }],
    };
  }
);

// --- run_praat_script ---
server.tool(
  'run_praat_script',
  'Execute a Praat script and return output.',
  {
    script: z.string().describe('Praat script source code'),
  },
  async (args) => {
    const result = runPraatScript(args.script);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          output: result.output,
          errors: result.errors,
        }, null, 2),
      }],
    };
  }
);

// --- run_js_script ---
server.tool(
  'run_js_script',
  'Execute a JavaScript script with access to audio data via the praat API object.',
  {
    script: z.string().describe('JavaScript source code'),
    ...audioInputSchema,
  },
  async (args) => {
    const { samples, sampleRate } = args.filePath || args.base64
      ? getAudio(args)
      : { samples: new Float32Array(0), sampleRate: 44100 };

    const result = runJavaScript(args.script, { samples, sampleRate });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          output: result.output,
          errors: result.errors,
        }, null, 2),
      }],
    };
  }
);

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
