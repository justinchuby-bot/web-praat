/**
 * Web Worker for heavy audio processing (noise reduction).
 * This runs the synchronous CPU FFT off the main thread.
 */
import { reduceNoise } from '../audio/soundEnhance';

self.onmessage = (event: MessageEvent) => {
  const { type, samples, sampleRate } = event.data;
  try {
    if (type === 'reduceNoise') {
      const result = reduceNoise(samples, sampleRate);
      (self as unknown as Worker).postMessage(
        { type: 'result', samples: result },
        [result.buffer] as unknown as Transferable[]
      );
    }
  } catch (e) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
