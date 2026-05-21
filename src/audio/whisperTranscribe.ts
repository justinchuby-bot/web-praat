/**
 * Whisper-based transcription + word timestamps using transformers.js.
 * Runs entirely in the browser (ONNX Runtime + WebAssembly).
 */
import { pipeline } from '@huggingface/transformers';
import type { TextGrid, Interval } from '../types';
import { createId } from '../utils/id';

export type WhisperModel = 'onnx-community/whisper-tiny' | 'onnx-community/whisper-base' | 'onnx-community/whisper-small';

export interface WhisperTranscribeOptions {
  model?: WhisperModel;
  language?: string | null;
  onProgress?: (progress: { status: string; progress?: number }) => void;
}

let cachedPipeline: any = null;
let cachedModelId: string | null = null;

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

  // Load model (with progress)
  if (!cachedPipeline || cachedModelId !== model) {
    onProgress?.({ status: 'downloading' });
    cachedPipeline = await pipeline('automatic-speech-recognition', model, {
      revision: 'output_attentions',  // Required for word-level timestamps
      dtype: 'q4',
      device: 'wasm',
      progress_callback: (data: any) => {
        if (data.status === 'progress' && data.progress != null) {
          onProgress?.({ status: 'downloading', progress: data.progress });
        } else if (data.status === 'done') {
          onProgress?.({ status: 'loading' });
        }
      },
    });
    cachedModelId = model;
  }

  onProgress?.({ status: 'transcribing' });

  // Resample to 16kHz if needed
  let audio: Float32Array;
  if (Math.abs(sampleRate - 16000) > 1) {
    const ratio = 16000 / sampleRate;
    const newLen = Math.round(samples.length * ratio);
    audio = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i / ratio;
      const idx = Math.floor(srcIdx);
      const frac = srcIdx - idx;
      const s0 = samples[idx] ?? 0;
      const s1 = samples[Math.min(idx + 1, samples.length - 1)] ?? 0;
      audio[i] = s0 + frac * (s1 - s0);
    }
  } else {
    audio = new Float32Array(samples);
  }

  // Run transcription
  const result = await cachedPipeline(audio, {
    return_timestamps: 'word',
    language: language || undefined,
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  onProgress?.({ status: 'done' });

  const duration = samples.length / sampleRate;
  return buildTextGrid(result, duration);
}

function buildTextGrid(result: any, duration: number): TextGrid {
  const intervals: Interval[] = [];

  if (result.chunks && result.chunks.length > 0) {
    for (const chunk of result.chunks) {
      if (!chunk.timestamp || chunk.timestamp[0] == null || chunk.timestamp[1] == null) continue;
      const [start, end] = chunk.timestamp;
      intervals.push({
        id: createId('int'),
        start: start as number,
        end: Math.min(end as number, duration),
        label: (chunk.text ?? '').trim(),
      });
    }
  } else if (result.text) {
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
