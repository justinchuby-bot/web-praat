/**
 * Helper to run heavy audio operations off the main thread.
 */
import type { AudioWorkerRequest, AudioWorkerResponse } from './audioWorker';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./audioWorker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export function runAudioWorker(request: AudioWorkerRequest): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const handler = (event: MessageEvent<AudioWorkerResponse>) => {
      w.removeEventListener('message', handler);
      if (event.data.type === 'result') {
        resolve(event.data.samples);
      } else {
        reject(new Error(event.data.message));
      }
    };
    w.addEventListener('message', handler);
    // Transfer the buffer to avoid copying
    const transfer = [request.samples.buffer];
    w.postMessage(request, transfer as unknown as Transferable[]);
  });
}
