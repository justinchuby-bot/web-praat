import { useCallback, useRef, useState } from 'react';
import { StreamingRecorder } from '../audio/streamingRecorder';
import { analyzeAudio } from '../audio/analyzer';
import type { AnalysisResult, AnalysisSettings } from '../types';

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

    // Update analysis every ~250ms (every ~2-3 chunks at 4096 buffer size / 44100Hz)
    updateIntervalRef.current = setInterval(() => {
      if (!recorderRef.current.isRecording) return;
      const samples = recorderRef.current.getAllSamples();
      if (samples.length < 2048) return;

      const sampleRate = recorderRef.current.sampleRate;
      const duration = samples.length / sampleRate;

      // For performance, only analyze the last ~10 seconds for the live view
      const maxSamples = sampleRate * 10;
      const analysisSlice = samples.length > maxSamples
        ? samples.slice(samples.length - maxSamples)
        : samples;

      const analysis = analyzeAudio(analysisSlice, sampleRate, settings);
      setState({
        isStreaming: true,
        streamAnalysis: analysis,
        streamDuration: duration,
      });
    }, 250);
  }, [settings]);

  const stopStreaming = useCallback((): { samples: Float32Array; sampleRate: number } => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

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
