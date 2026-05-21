/**
 * Whisper-based transcription + word timestamps using transformers.js.
 * Runs in a Web Worker to keep UI responsive.
 */
import type { TextGrid, Interval } from '../types';
import { createId } from '../utils/id';

export type WhisperModel = 'onnx-community/whisper-tiny' | 'onnx-community/whisper-base' | 'onnx-community/whisper-small';

export interface WhisperTranscribeOptions {
  model?: WhisperModel;
  language?: string | null;
  onProgress?: (progress: { status: string; progress?: number }) => void;
}

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/whisperWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}

/**
 * Transcribe audio and return a TextGrid with word-level intervals.
 * Runs entirely off the main thread via Web Worker.
 */
export function whisperTranscribe(
  samples: Float32Array,
  sampleRate: number,
  options: WhisperTranscribeOptions = {}
): Promise<TextGrid> {
  const {
    model = 'onnx-community/whisper-small',
    language = null,
    onProgress,
  } = options;

  return new Promise((resolve, reject) => {
    const w = getWorker();

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

    const handler = (event: MessageEvent) => {
      const { type, status, progress, result, message } = event.data;
      if (type === 'progress') {
        onProgress?.({ status, progress });
      } else if (type === 'result') {
        w.removeEventListener('message', handler);
        const duration = samples.length / sampleRate;
        resolve(buildTextGrid(result, duration));
      } else if (type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(message));
      }
    };

    w.addEventListener('message', handler);
    w.postMessage(
      { type: 'transcribe', model, audio, language, revision: 'output_attentions' },
      [audio.buffer]
    );
  });
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
