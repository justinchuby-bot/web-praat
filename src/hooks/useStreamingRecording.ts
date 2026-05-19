import { useCallback, useRef, useState } from 'react';
import { StreamingRecorder } from '../audio/streamingRecorder';
import type { AnalysisResult, AnalysisSettings } from '../types';
import type { AnalysisWorkerRequest } from '../workers/analysis.worker';

export interface StreamingRecordingState {
  isStreaming: boolean;
  streamAnalysis: AnalysisResult | null;
  streamDuration: number;
}

/**
 * Hook that manages streaming recording with live spectrogram updates.
 * Analyzes accumulated audio periodically during recording.
 */
export function useStreamingRecording(settings: AnalysisSettings) {
  const [state, setState] = useState<StreamingRecordingState>({
    isStreaming: false,
    streamAnalysis: null,
    streamDuration: 0,
  });

  const recorderRef = useRef(new StreamingRecorder());
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkCountRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(false);

  const startStreaming = useCallback(async () => {
    chunkCountRef.current = 0;

    await recorderRef.current.start({
      onData: () => {
        chunkCountRef.current++;
      },
    });

    setState({
      isStreaming: true,
      streamAnalysis: null,
      streamDuration: 0,
    });

    // Create a dedicated worker for streaming analysis
    const worker = new Worker(
      new URL('../workers/analysis.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e: MessageEvent<{ id: number; result: AnalysisResult }>) => {
      pendingRef.current = false;
      const { result } = e.data;
      const samples = recorderRef.current.getAllSamples();
      const sampleRate = recorderRef.current.sampleRate;
      setState({
        isStreaming: true,
        streamAnalysis: result,
        streamDuration: samples.length / sampleRate,
      });
    };
    workerRef.current = worker;

    // Update analysis every ~250ms, skip if previous analysis still pending
    updateIntervalRef.current = setInterval(() => {
      if (!recorderRef.current.isRecording) return;
      if (pendingRef.current) return; // skip if worker is busy
      const samples = recorderRef.current.getAllSamples();
      if (samples.length < 2048) return;

      const sampleRate = recorderRef.current.sampleRate;

      // For performance, only analyze the last ~10 seconds for the live view
      const maxSamples = sampleRate * 10;
      const analysisSlice = samples.length > maxSamples
        ? samples.slice(samples.length - maxSamples)
        : samples;

      pendingRef.current = true;
      const msg: AnalysisWorkerRequest = { id: 0, samples: analysisSlice, sampleRate, settings };
      worker.postMessage(msg, [analysisSlice.buffer]);
    }, 250);
  }, [settings]);

  const stopStreaming = useCallback((): { samples: Float32Array; sampleRate: number } => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    pendingRef.current = false;

    const result = recorderRef.current.stop();
    setState({
      isStreaming: false,
      streamAnalysis: null,
      streamDuration: 0,
    });

    return result;
  }, []);

  return {
    ...state,
    startStreaming,
    stopStreaming,
  };
}
