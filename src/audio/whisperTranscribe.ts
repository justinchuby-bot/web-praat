/**
 * Whisper-based transcription + word timestamps using transformers.js.
 * Runs entirely in the browser (ONNX Runtime + WebAssembly).
 * Model: Whisper base (~150 MB, downloaded on first use).
 */
import { pipeline, type AutomaticSpeechRecognitionOutput } from '@huggingface/transformers';
import type { TextGrid, Interval } from '../types';
import { createId } from '../utils/id';

export type WhisperModel = 'onnx-community/whisper-tiny' | 'onnx-community/whisper-base' | 'onnx-community/whisper-small';

export interface WhisperTranscribeOptions {
  model?: WhisperModel;
  language?: string | null; // null = auto-detect
  onProgress?: (progress: { status: string; progress?: number }) => void;
}

let transcriber: Awaited<ReturnType<typeof pipeline>> | null = null;
let loadedModel: string | null = null;

async function getTranscriber(model: WhisperModel, onProgress?: WhisperTranscribeOptions['onProgress']) {
  if (transcriber && loadedModel === model) return transcriber;

  transcriber = await pipeline('automatic-speech-recognition', model, {
    dtype: 'q4', // 4-bit quantized for smaller download
    device: 'wasm',
    progress_callback: onProgress ? (data: any) => {
      if (data.status === 'progress') {
        onProgress({ status: 'downloading', progress: data.progress });
      } else if (data.status === 'ready') {
        onProgress({ status: 'ready' });
      }
    } : undefined,
  });
  loadedModel = model;
  return transcriber;
}

/**
 * Transcribe audio and return a TextGrid with word-level intervals.
 */
export async function whisperTranscribe(
  samples: Float32Array,
  sampleRate: number,
  options: WhisperTranscribeOptions = {}
): Promise<TextGrid> {
  const {
    model = 'onnx-community/whisper-small',
    language = null,
    onProgress,
  } = options;

  onProgress?.({ status: 'loading' });
  const pipe = await getTranscriber(model, onProgress);

  onProgress?.({ status: 'transcribing' });

  // Resample to 16kHz if needed (Whisper expects 16kHz)
  let audio: Float32Array;
  if (sampleRate !== 16000) {
    const ratio = 16000 / sampleRate;
    const newLen = Math.round(samples.length * ratio);
    audio = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i / ratio;
      const idx = Math.floor(srcIdx);
      const frac = srcIdx - idx;
      audio[i] = (1 - frac) * (samples[idx] ?? 0) + frac * (samples[idx + 1] ?? 0);
    }
  } else {
    audio = samples;
  }

  const result = await (pipe as any)(audio, {
    return_timestamps: 'word',
    language: language || undefined,
    task: 'transcribe',
  }) as AutomaticSpeechRecognitionOutput;

  onProgress?.({ status: 'done' });

  return buildTextGrid(result, samples.length / sampleRate);
}

function buildTextGrid(result: AutomaticSpeechRecognitionOutput, duration: number): TextGrid {
  const intervals: Interval[] = [];

  if (result.chunks && result.chunks.length > 0) {
    for (const chunk of result.chunks) {
      const [start, end] = chunk.timestamp as [number, number];
      if (start == null || end == null) continue;
      intervals.push({
        id: createId('int'),
        start,
        end: Math.min(end, duration),
        label: chunk.text.trim(),
      });
    }
  } else if (result.text) {
    // No timestamps — put entire text as one interval
    intervals.push({
      id: createId('int'),
      start: 0,
      end: duration,
      label: result.text.trim(),
    });
  }

  // Fill gaps
  const filled: Interval[] = [];
  let lastEnd = 0;
  for (const int of intervals) {
    if (int.start > lastEnd + 0.01) {
      filled.push({ id: createId('int'), start: lastEnd, end: int.start, label: '' });
    }
    filled.push(int);
    lastEnd = int.end;
  }
  if (lastEnd < duration - 0.01) {
    filled.push({ id: createId('int'), start: lastEnd, end: duration, label: '' });
  }
  if (filled.length === 0) {
    filled.push({ id: createId('int'), start: 0, end: duration, label: '' });
  }

  return {
    xmin: 0,
    xmax: duration,
    tiers: [{
      id: createId('tier'),
      name: 'words',
      kind: 'interval',
      intervals: filled,
    }],
  };
}
