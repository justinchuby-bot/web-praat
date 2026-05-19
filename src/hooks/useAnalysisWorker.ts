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

  useEffect(() => {
    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ id: number; result: AnalysisResult }>) => {
      const { id, result } = e.data;
      const resolve = pendingRef.current.get(id);
      if (resolve) {
        pendingRef.current.delete(id);
        resolve(result);
      }
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  const analyze = useCallback(
    (samples: Float32Array, sampleRate: number, settings: Partial<AnalysisSettings>): Promise<AnalysisResult> => {
      return new Promise((resolve) => {
        const id = ++idRef.current;
        const worker = workerRef.current;
        if (!worker) {
          // Fallback: import synchronously (shouldn't happen in practice)
          import('../audio/analyzer').then(({ analyzeAudio }) => {
            resolve(analyzeAudio(samples, sampleRate, settings));
          });
          return;
        }
        pendingRef.current.set(id, resolve);
        const msg: AnalysisWorkerRequest = { id, samples, sampleRate, settings };
        worker.postMessage(msg, [samples.buffer]);
      });
    },
    []
  );

  return { analyze };
}
