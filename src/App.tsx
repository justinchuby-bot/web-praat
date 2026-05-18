import { useState, useRef, useCallback, useEffect } from 'react';
import { Waveform } from './components/Waveform';
import { Spectrogram } from './components/Spectrogram';
import { Controls } from './components/Controls';
import { Sidebar } from './components/Sidebar';
import { analyzeAudio } from './audio/analyzer';
import { AudioRecorder, loadAudioFile } from './audio/recorder';
import type { AnalysisResult, TimeSelection } from './types';

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selection, setSelection] = useState<TimeSelection | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPitch, setShowPitch] = useState(true);
  const [showFormants, setShowFormants] = useState(true);
  const [showIntensity, setShowIntensity] = useState(true);

  const recorderRef = useRef(new AudioRecorder());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const playStartRef = useRef(0);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const processAudioBuffer = useCallback((buffer: AudioBuffer) => {
    audioBufferRef.current = buffer;
    const samples = buffer.getChannelData(0);
    const result = analyzeAudio(samples, buffer.sampleRate);
    setAnalysis(result);
    setSelection(null);
    setCurrentTime(0);
  }, []);

  const handleLoadFile = useCallback(async (file: File) => {
    const buffer = await loadAudioFile(file);
    processAudioBuffer(buffer);
  }, [processAudioBuffer]);

  const handleRecord = useCallback(async () => {
    await recorderRef.current.start();
    setIsRecording(true);
  }, []);

  const handleStopRecord = useCallback(async () => {
    const buffer = await recorderRef.current.stop();
    setIsRecording(false);
    processAudioBuffer(buffer);
  }, [processAudioBuffer]);

  const handlePlay = useCallback(() => {
    if (!audioBufferRef.current) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(ctx.destination);

    const startOffset = selection?.start ?? 0;
    const duration = selection ? selection.end - selection.start : undefined;

    source.start(0, startOffset, duration);
    sourceRef.current = source;
    playStartRef.current = ctx.currentTime - startOffset;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const updateTime = () => {
      if (!audioCtxRef.current) return;
      const t = audioCtxRef.current.currentTime - playStartRef.current;
      setCurrentTime(t);
      animFrameRef.current = requestAnimationFrame(updateTime);
    };
    updateTime();
  }, [selection]);

  const handlePause = useCallback(() => {
    sourceRef.current?.stop();
    audioCtxRef.current?.close();
    cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);
  }, []);

  // Drag and drop
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file && file.type.startsWith('audio/')) {
        handleLoadFile(file);
      }
    };
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', prevent);
    return () => {
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', prevent);
    };
  }, [handleLoadFile]);

  return (
    <div className="app">
      <Sidebar
        showPitch={showPitch}
        showFormants={showFormants}
        showIntensity={showIntensity}
        onTogglePitch={() => setShowPitch((v) => !v)}
        onToggleFormants={() => setShowFormants((v) => !v)}
        onToggleIntensity={() => setShowIntensity((v) => !v)}
      />
      <main className="main-area">
        <Controls
          hasAudio={!!analysis}
          isPlaying={isPlaying}
          isRecording={isRecording}
          selection={selection}
          duration={analysis?.duration ?? 0}
          onRecord={handleRecord}
          onStopRecord={handleStopRecord}
          onPlay={handlePlay}
          onPause={handlePause}
          onLoadFile={handleLoadFile}
        />
        <div className="visualizations">
          {!analysis && (
            <div className="empty-state">
              <div className="empty-icon">🎙️</div>
              <p>Drop an audio file here or click Record to begin</p>
              <p className="empty-hint">Supports WAV, MP3, OGG</p>
            </div>
          )}
          {analysis && (
            <>
              <Waveform
                analysis={analysis}
                selection={selection}
                currentTime={currentTime}
                onSelectionChange={setSelection}
              />
              <Spectrogram
                analysis={analysis}
                selection={selection}
                currentTime={currentTime}
                showPitch={showPitch}
                showFormants={showFormants}
                showIntensity={showIntensity}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
