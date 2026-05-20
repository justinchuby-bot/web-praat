/**
 * Web Worker for heavy audio processing (noise reduction, silence removal).
 */
import { reduceNoise, removeSilence } from './audio/soundEnhance';

export type AudioWorkerRequest =
  | { type: 'reduceNoise'; samples: Float32Array; sampleRate: number }
  | { type: 'removeSilence'; samples: Float32Array; sampleRate: number };

export type AudioWorkerResponse =
  | { type: 'result'; samples: Float32Array }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<AudioWorkerRequest>) => {
  const { data } = event;
  try {
    let result: Float32Array;
    if (data.type === 'reduceNoise') {
      result = reduceNoise(data.samples, data.sampleRate);
    } else {
      result = removeSilence(data.samples, data.sampleRate);
    }
    (self as unknown as Worker).postMessage(
      { type: 'result', samples: result } satisfies AudioWorkerResponse,
      [result.buffer] as unknown as Transferable[]
    );
  } catch (e) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
    } satisfies AudioWorkerResponse);
  }
};
