import { useCallback, useEffect, useRef } from 'react';
import type { AnalysisResult, AnalysisSettings } from '../types';
import type { AnalysisWorkerRequest } from '../workers/analysis.worker';

/**
 * Hook that offloads analyzeAudio to a Web Worker.
 * Falls back to main-thread analysis if Workers are unsupported.
 */
export function useAnalysisWorker() {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const pendingRef = useRef<Map<number, (r: AnalysisResult) => void>>(new Map());
  const progressRef = useRef<Map<number, (v: number) => void>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ type?: string; id: number; result?: AnalysisResult; value?: number }>) => {
      const { type, id } = e.data;
      if (type === 'progress') {
        const cb = progressRef.current.get(id);
        if (cb && e.data.value !== undefined) cb(e.data.value);
        return;
      }
      // type === 'result' or legacy
      const resolve = pendingRef.current.get(id);
      if (resolve && e.data.result) {
        pendingRef.current.delete(id);
        progressRef.current.delete(id);
        resolve(e.data.result);
      }
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
      progressRef.current.clear();
    };
  }, []);

  const analyze = useCallback(
    (samples: Float32Array, sampleRate: number, settings: Partial<AnalysisSettings>, onProgress?: (v: number) => void): Promise<AnalysisResult> => {
      return new Promise((resolve) => {
        const id = ++idRef.current;
        const worker = workerRef.current;
        if (!worker) {
          import('../audio/analyzer').then(({ analyzeAudio }) => {
            resolve(analyzeAudio(samples, sampleRate, settings));
          });
          return;
        }
        pendingRef.current.set(id, resolve);
        if (onProgress) progressRef.current.set(id, onProgress);
        const msg: AnalysisWorkerRequest = { id, samples, sampleRate, settings };
        worker.postMessage(msg, [samples.buffer]);
      });
    },
    []
  );

  return { analyze };
}
