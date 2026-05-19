import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useStreamingRecording } from './hooks/useStreamingRecording';
import { useAnalysisWorker } from './hooks/useAnalysisWorker';
import { defaultAnalysisSettings, defaultFilterSettings, createEmptyTextGrid } from './audio/defaults';
import { AudioEditorHistory, ReplaceRangeCommand } from './audio/editor';
import { applyBiquadFilter } from './audio/filters';
import { computeRhythmMetrics } from './audio/rhythm';
import { loadAudioFile } from './audio/recorder';
import { computeSpectrumSlice } from './audio/spectrum';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { FilterPanel } from './components/FilterPanel';
import { MenuBar } from './components/MenuBar';
import { RhythmPanel } from './components/RhythmPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { Spectrogram } from './components/Spectrogram';
import { SpectrumSlice } from './components/SpectrumSlice';
import { StatusBar } from './components/StatusBar';
import { TextGridEditor } from './components/TextGridEditor';
import { TimeRuler } from './components/TimeRuler';
import { Toolbar } from './components/Toolbar';
import { HarmonicityPanel } from './components/HarmonicityPanel';
import { VoiceQualityPanel } from './components/VoiceQualityPanel';
import { Waveform } from './components/Waveform';
import {
  downloadBinaryFile,
  downloadTextFile,
  exportFormantCsv,
  exportHarmonicityCsv,
  exportIntensityCsv,
  exportPitchCsv,
  exportSelectedRegionWav,
  exportTextGrid,
} from './export';
import { addPointToTier, addTier, deleteBoundary, deletePoint, moveBoundary, movePoint, parseTextGrid, removeTier, renameTier, splitIntervalTierBoundary, updateTextGridLabel } from './textgrid/parser';
import type {
  AnalysisResult,
  AnalysisSettings,
  FilterSettings,
  TextGrid,
  TimeSelection,
} from './types';
import { fitToWindow, panViewRange, selectionToView, zoomAroundPoint } from './utils/view';

function createAudioBufferFromSamples(samples: Float32Array, sampleRate: number): AudioBuffer {
  const buffer = new AudioBuffer({ length: samples.length, sampleRate, numberOfChannels: 1 });
  buffer.getChannelData(0).set(samples);
  return buffer;
}

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selection, setSelection] = useState<TimeSelection | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPitch, setShowPitch] = useState(true);
  const [showFormants, setShowFormants] = useState(true);
  const [showIntensity, setShowIntensity] = useState(true);
  const [settings, setSettings] = useState<AnalysisSettings>(defaultAnalysisSettings);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(defaultFilterSettings);
  const [textGrid, setTextGrid] = useState<TextGrid>(createEmptyTextGrid(1));
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(1);
  const [sampleRate, setSampleRate] = useState(44100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const streaming = useStreamingRecording(settings);
  const { analyze: analyzeInWorker } = useAnalysisWorker();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const playStartRef = useRef(0);
  const editorRef = useRef(new AudioEditorHistory(new Float32Array(0)));
  const originalSamplesRef = useRef<Float32Array | null>(null);
  const currentSamplesRef = useRef<Float32Array | null>(null);
  const textGridRef = useRef<TextGrid>(createEmptyTextGrid(1));

  const viewRange = useMemo(() => ({ start: viewStart, end: viewEnd }), [viewStart, viewEnd]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(editorRef.current.canUndo());
    setCanRedo(editorRef.current.canRedo());
  }, []);

  const [analyzing, setAnalyzing] = useState(false);

  const processSamples = useCallback(
    (samples: Float32Array, nextSampleRate: number, resetEditor = false) => {
      currentSamplesRef.current = Float32Array.from(samples);
      setSampleRate(nextSampleRate);
      setAnalyzing(true);
      // Copy samples since we transfer the buffer to the worker
      const copy = Float32Array.from(samples);
      analyzeInWorker(copy, nextSampleRate, settingsRef.current).then((nextAnalysis) => {
        setAnalyzing(false);
        setAnalysis(nextAnalysis);
        setSelection(null);
        setCurrentTime(0);
        const nextGrid =
          textGridRef.current.xmax > 0 && textGridRef.current.xmax !== 1 && !resetEditor
            ? { ...textGridRef.current, xmax: nextAnalysis.duration }
            : createEmptyTextGrid(nextAnalysis.duration);
        textGridRef.current = nextGrid;
        setTextGrid(nextGrid);
        setActiveTierId(nextGrid.tiers[0]?.id ?? null);
        const fitted = fitToWindow(nextAnalysis.duration);
        setViewStart(fitted.start);
        setViewEnd(fitted.end);
        if (resetEditor) {
          editorRef.current.setSamples(samples);
          syncHistoryFlags();
        }
      });
    },
    [syncHistoryFlags, analyzeInWorker]
  );

  const processAudioBuffer = useCallback(
    (buffer: AudioBuffer, resetEditor = true) => {
      const samples = Float32Array.from(buffer.getChannelData(0));
      if (resetEditor) {
        originalSamplesRef.current = Float32Array.from(samples);
      }
      processSamples(samples, buffer.sampleRate, resetEditor);
    },
    [processSamples]
  );

  useEffect(() => {
    if (!currentSamplesRef.current) return;
    processSamples(currentSamplesRef.current, sampleRate, false);
  }, [processSamples, sampleRate, settings]);

  useEffect(() => {
    textGridRef.current = textGrid;
  }, [textGrid]);

  const handleLoadFile = useCallback(async (file: File) => {
    const buffer = await loadAudioFile(file);
    processAudioBuffer(buffer, true);
  }, [processAudioBuffer]);

  const handleImportTextGrid = useCallback(async (file: File) => {
    const content = await file.text();
    const parsed = parseTextGrid(content);
    textGridRef.current = parsed;
    setTextGrid(parsed);
    setActiveTierId(parsed.tiers[0]?.id ?? null);
  }, []);

  const handleRecord = useCallback(async () => {
    await streaming.startStreaming();
    setIsRecording(true);
  }, [streaming]);

  const handleStopRecord = useCallback(() => {
    const { samples, sampleRate: sr } = streaming.stopStreaming();
    setIsRecording(false);
    if (samples.length > 0) {
      originalSamplesRef.current = Float32Array.from(samples);
      editorRef.current.setSamples(samples);
      processSamples(samples, sr, true);
    }
  }, [streaming, processSamples]);

  const handlePlay = useCallback(() => {
    if (!currentSamplesRef.current) return;
    const buffer = createAudioBufferFromSamples(currentSamplesRef.current, sampleRate);
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
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
      setCurrentTime(audioCtxRef.current.currentTime - playStartRef.current);
      animFrameRef.current = requestAnimationFrame(updateTime);
    };
    updateTime();
  }, [sampleRate, selection]);

  const handlePause = useCallback(() => {
    sourceRef.current?.stop();
    audioCtxRef.current?.close();
    cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);
  }, []);

  const commitSamples = useCallback((samples: Float32Array) => {
    processSamples(samples, sampleRate, false);
    syncHistoryFlags();
  }, [processSamples, sampleRate, syncHistoryFlags]);

  const selectionToSampleRange = useCallback(() => {
    if (!selection || !currentSamplesRef.current) return null;
    return {
      start: Math.floor(selection.start * sampleRate),
      end: Math.ceil(selection.end * sampleRate),
    };
  }, [sampleRate, selection]);

  const handleCut = useCallback(() => {
    const range = selectionToSampleRange();
    if (!range) return;
    editorRef.current.copy(range.start, range.end);
    const state = editorRef.current.execute(new ReplaceRangeCommand(range.start, range.end, new Float32Array(0)));
    commitSamples(state.samples);
    setSelection(null);
  }, [commitSamples, selectionToSampleRange]);

  const handleCopy = useCallback(() => {
    const range = selectionToSampleRange();
    if (!range) return;
    editorRef.current.copy(range.start, range.end);
  }, [selectionToSampleRange]);

  const handlePaste = useCallback(() => {
    const state = editorRef.current.getState();
    const clipboard = state.clipboard;
    if (!clipboard) return;
    const insertAt = selection ? Math.floor(selection.start * sampleRate) : state.samples.length;
    const nextState = editorRef.current.execute(new ReplaceRangeCommand(insertAt, insertAt, clipboard));
    commitSamples(nextState.samples);
  }, [commitSamples, sampleRate, selection]);

  const handleDelete = useCallback(() => {
    const range = selectionToSampleRange();
    if (!range) return;
    const state = editorRef.current.execute(new ReplaceRangeCommand(range.start, range.end, new Float32Array(0)));
    commitSamples(state.samples);
    setSelection(null);
  }, [commitSamples, selectionToSampleRange]);

  const handleUndo = useCallback(() => {
    const state = editorRef.current.undo();
    if (!state) return;
    commitSamples(state.samples);
  }, [commitSamples]);

  const handleRedo = useCallback(() => {
    const state = editorRef.current.redo();
    if (!state) return;
    commitSamples(state.samples);
  }, [commitSamples]);

  const handleApplyFilter = useCallback(() => {
    if (!currentSamplesRef.current) return;
    const filtered = applyBiquadFilter(currentSamplesRef.current, sampleRate, filterSettings);
    editorRef.current.setSamples(filtered);
    commitSamples(filtered);
  }, [commitSamples, filterSettings, sampleRate]);

  const handleResetFilter = useCallback(() => {
    if (!originalSamplesRef.current) return;
    editorRef.current.setSamples(originalSamplesRef.current);
    processSamples(originalSamplesRef.current, sampleRate, true);
  }, [processSamples, sampleRate]);

  const handleWheelZoom = useCallback((pivotTime: number, zoomFactor: number) => {
    if (!analysis) return;
    const next = zoomAroundPoint(viewRange, pivotTime, zoomFactor, analysis.duration);
    setViewStart(next.start);
    setViewEnd(next.end);
  }, [analysis, viewRange]);

  const handlePan = useCallback((deltaTime: number) => {
    if (!analysis) return;
    const next = panViewRange(viewRange, deltaTime, analysis.duration);
    setViewStart(next.start);
    setViewEnd(next.end);
  }, [analysis, viewRange]);

  const handleZoomSelection = useCallback((nextSelection?: TimeSelection) => {
    if (!analysis) return;
    const target = nextSelection ?? selection;
    if (!target) return;
    const next = selectionToView(target, analysis.duration);
    setViewStart(next.start);
    setViewEnd(next.end);
  }, [analysis, selection]);

  const handleFitToWindow = useCallback(() => {
    if (!analysis) return;
    const next = fitToWindow(analysis.duration);
    setViewStart(next.start);
    setViewEnd(next.end);
  }, [analysis]);

  const handleSpectrumSliceSelect = useCallback((time: number) => {
    if (!currentSamplesRef.current || !analysis) return;
    const slice = computeSpectrumSlice(currentSamplesRef.current, sampleRate, time, settings);
    setAnalysis({ ...analysis, spectrumSlice: slice });
  }, [analysis, sampleRate, settings]);

  const intervalDurations = useMemo(() => {
    const tier = textGrid.tiers.find((item) => item.id === activeTierId && item.kind === 'interval');
    return tier && tier.kind === 'interval'
      ? tier.intervals.map((interval) => interval.end - interval.start).filter((duration) => duration > 0)
      : [];
  }, [activeTierId, textGrid.tiers]);
  const rhythmMetrics = useMemo(() => computeRhythmMetrics(intervalDurations), [intervalDurations]);

  useEffect(() => {
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      if (file.name.endsWith('.TextGrid')) {
        void handleImportTextGrid(file);
      } else if (file.type.startsWith('audio/')) {
        void handleLoadFile(file);
      }
    };
    const prevent = (event: DragEvent) => event.preventDefault();
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', prevent);
    return () => {
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', prevent);
    };
  }, [handleImportTextGrid, handleLoadFile]);

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!analysis) return;
    setSelection({ start: 0, end: analysis.duration });
  }, [analysis]);

  const handleMoveSelectionLeft = useCallback(() => {
    if (!analysis) return;
    const step = (viewEnd - viewStart) * 0.05;
    if (selection) {
      const shift = Math.min(step, selection.start);
      setSelection({ start: selection.start - shift, end: selection.end - shift });
    } else {
      const next = panViewRange(viewRange, -step, analysis.duration);
      setViewStart(next.start);
      setViewEnd(next.end);
    }
  }, [analysis, selection, viewEnd, viewStart, viewRange]);

  const handleMoveSelectionRight = useCallback(() => {
    if (!analysis) return;
    const step = (viewEnd - viewStart) * 0.05;
    if (selection) {
      const shift = Math.min(step, analysis.duration - selection.end);
      setSelection({ start: selection.start + shift, end: selection.end + shift });
    } else {
      const next = panViewRange(viewRange, step, analysis.duration);
      setViewStart(next.start);
      setViewEnd(next.end);
    }
  }, [analysis, selection, viewEnd, viewStart, viewRange]);

  const handleZoomIn = useCallback(() => {
    if (!analysis) return;
    const center = (viewStart + viewEnd) / 2;
    const next = zoomAroundPoint(viewRange, center, 0.8, analysis.duration);
    setViewStart(next.start);
    setViewEnd(next.end);
  }, [analysis, viewEnd, viewStart, viewRange]);

  const handleZoomOut = useCallback(() => {
    if (!analysis) return;
    const center = (viewStart + viewEnd) / 2;
    const next = zoomAroundPoint(viewRange, center, 1.25, analysis.duration);
    setViewStart(next.start);
    setViewEnd(next.end);
  }, [analysis, viewEnd, viewStart, viewRange]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) handlePause();
    else handlePlay();
  }, [isPlaying, handlePause, handlePlay]);

  const shortcutHandlers = useMemo(() => ({
    onPlayPause: handlePlayPause,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCut: handleCut,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: handleDelete,
    onSelectAll: handleSelectAll,
    onMoveSelectionLeft: handleMoveSelectionLeft,
    onMoveSelectionRight: handleMoveSelectionRight,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitToWindow: handleFitToWindow,
  }), [handlePlayPause, handleUndo, handleRedo, handleCut, handleCopy, handlePaste, handleDelete, handleSelectAll, handleMoveSelectionLeft, handleMoveSelectionRight, handleZoomIn, handleZoomOut, handleFitToWindow]);

  useKeyboardShortcuts(shortcutHandlers, true);

  return (
    <div className="app-layout">
      <MenuBar
        hasAudio={!!analysis}
        selection={selection}
        canUndo={canUndo}
        canRedo={canRedo}
        onLoadFile={handleLoadFile}
        onImportTextGrid={handleImportTextGrid}
        onExportTextGrid={() => downloadTextFile('annotations.TextGrid', exportTextGrid(textGrid))}
        onExportFullWav={() => {
          if (!currentSamplesRef.current) return;
          downloadBinaryFile('audio.wav', exportSelectedRegionWav(currentSamplesRef.current, sampleRate));
        }}
        onExportSelectionWav={() => {
          const range = selectionToSampleRange();
          if (!range || !currentSamplesRef.current) return;
          const samples = currentSamplesRef.current.slice(range.start, range.end);
          downloadBinaryFile('selection.wav', exportSelectedRegionWav(samples, sampleRate));
        }}
        onExportPitchCsv={() => analysis && downloadTextFile('pitch.csv', exportPitchCsv(analysis.pitch), 'text/csv')}
        onExportFormantCsv={() => analysis && downloadTextFile('formants.csv', exportFormantCsv(analysis.formants), 'text/csv')}
        onExportIntensityCsv={() => analysis && downloadTextFile('intensity.csv', exportIntensityCsv(analysis.intensity), 'text/csv')}
        onExportHarmonicityCsv={() => analysis && downloadTextFile('harmonicity.csv', exportHarmonicityCsv(analysis.harmonicity), 'text/csv')}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToWindow={handleFitToWindow}
        onZoomToSelection={() => handleZoomSelection()}
        onTogglePitch={() => setShowPitch((v) => !v)}
        onToggleFormants={() => setShowFormants((v) => !v)}
        onToggleIntensity={() => setShowIntensity((v) => !v)}
        showPitch={showPitch}
        showFormants={showFormants}
        showIntensity={showIntensity}
      />

      <Toolbar
        hasAudio={!!analysis}
        isPlaying={isPlaying}
        isRecording={isRecording}
        selection={selection}
        canUndo={canUndo}
        canRedo={canRedo}
        onRecord={handleRecord}
        onStopRecord={handleStopRecord}
        onPlay={handlePlay}
        onPause={handlePause}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToWindow={handleFitToWindow}
      />

      <div className="app-body">
        <Sidebar
          showPitch={showPitch}
          showFormants={showFormants}
          showIntensity={showIntensity}
          onTogglePitch={() => setShowPitch((value) => !value)}
          onToggleFormants={() => setShowFormants((value) => !value)}
          onToggleIntensity={() => setShowIntensity((value) => !value)}
        >
          <SettingsPanel settings={settings} onChange={setSettings} />
          <FilterPanel settings={filterSettings} onChange={setFilterSettings} onApply={handleApplyFilter} onReset={handleResetFilter} />
        </Sidebar>

        <main className="main-area" role="main" aria-label="Audio editor">
          <div className="visualizations">
          {!analysis && !streaming.streamAnalysis && (
            <div className="empty-state">
              <div className="empty-icon">🎙️</div>
              <p>Drop audio or a TextGrid here, or start recording.</p>
              <p className="empty-hint">Waveform, spectrogram, pitch, formants, intensity, TextGrid, editing, filters, and exports are all live in this view.</p>
            </div>
          )}

          {!analysis && streaming.streamAnalysis && (
            <>
              <div className="streaming-indicator">
                <span className="recording-dot" /> Recording — {streaming.streamDuration.toFixed(1)}s
              </div>
              <TimeRuler duration={streaming.streamAnalysis.duration} viewRange={{ start: 0, end: streaming.streamAnalysis.duration }} />
              <Waveform
                analysis={streaming.streamAnalysis}
                selection={null}
                currentTime={streaming.streamAnalysis.duration}
                viewRange={{ start: 0, end: streaming.streamAnalysis.duration }}
                onSelectionChange={() => {}}
                onWheelZoom={() => {}}
                onPan={() => {}}
                onZoomSelection={() => {}}
              />
              <Spectrogram
                analysis={streaming.streamAnalysis}
                selection={null}
                currentTime={streaming.streamAnalysis.duration}
                viewRange={{ start: 0, end: streaming.streamAnalysis.duration }}
                showPitch={showPitch}
                showFormants={showFormants}
                showIntensity={showIntensity}
                onWheelZoom={() => {}}
                onPan={() => {}}
                onZoomSelection={() => {}}
                onSelectionChange={() => {}}
                onSpectrumSliceSelect={() => {}}
              />
            </>
          )}

          {analyzing && (
            <div className="flex items-center justify-center py-8 text-zinc-400">
              <span className="animate-pulse">Analyzing…</span>
            </div>
          )}

          {analysis && (
            <>
              <TimeRuler duration={analysis.duration} viewRange={viewRange} />
              <Waveform
                analysis={analysis}
                selection={selection}
                currentTime={currentTime}
                viewRange={viewRange}
                onSelectionChange={setSelection}
                onWheelZoom={handleWheelZoom}
                onPan={handlePan}
                onZoomSelection={handleZoomSelection}
              />
              <Spectrogram
                analysis={analysis}
                selection={selection}
                currentTime={currentTime}
                viewRange={viewRange}
                showPitch={showPitch}
                showFormants={showFormants}
                showIntensity={showIntensity}
                onWheelZoom={handleWheelZoom}
                onPan={handlePan}
                onZoomSelection={handleZoomSelection}
                onSelectionChange={setSelection}
                onSpectrumSliceSelect={handleSpectrumSliceSelect}
              />
              <TextGridEditor
                textGrid={textGrid}
                viewRange={viewRange}
                selection={selection}
                activeTierId={activeTierId}
                onActiveTierChange={setActiveTierId}
                onAddBoundary={(tierId, time) => setTextGrid((current) => splitIntervalTierBoundary(current, tierId, time))}
                onAddPoint={(tierId, time) => setTextGrid((current) => addPointToTier(current, tierId, time))}
                onMoveBoundary={(tierId, boundaryIndex, time) => setTextGrid((current) => moveBoundary(current, tierId, boundaryIndex, time))}
                onMovePoint={(tierId, pointId, time) => setTextGrid((current) => movePoint(current, tierId, pointId, time))}
                onEditLabel={(tierId, itemId, currentLabel) => {
                  const nextLabel = window.prompt('Edit label', currentLabel);
                  if (nextLabel === null) return;
                  setTextGrid((current) => updateTextGridLabel(current, tierId, itemId, nextLabel));
                }}
                onAddTier={(name, kind) => setTextGrid((current) => addTier(current, name, kind))}
                onRemoveTier={(tierId) => setTextGrid((current) => removeTier(current, tierId))}
                onRenameTier={(tierId, name) => setTextGrid((current) => renameTier(current, tierId, name))}
                onDeleteBoundary={(tierId, boundaryIndex) => setTextGrid((current) => deleteBoundary(current, tierId, boundaryIndex))}
                onDeletePoint={(tierId, pointId) => setTextGrid((current) => deletePoint(current, tierId, pointId))}
              />
            </>
          )}
        </div>

          {analysis && (
            <section className="bottom-panels" aria-label="Analysis panels">
              <SpectrumSlice slice={analysis.spectrumSlice} />
              <VoiceQualityPanel metrics={analysis.voiceQuality} />
              <HarmonicityPanel data={analysis.harmonicity} viewStart={viewStart} viewEnd={viewEnd} />
              <RhythmPanel metrics={rhythmMetrics} />
            </section>
          )}
        </main>
      </div>

      <StatusBar
        hasAudio={!!analysis}
        duration={analysis?.duration ?? 0}
        selection={selection}
        sampleRate={sampleRate}
        isRecording={isRecording}
        streamDuration={streaming.streamDuration}
      />
      <KeyboardShortcutsDialog />
    </div>
  );
}
