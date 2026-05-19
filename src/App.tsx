import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initGpuFft } from './utils/fft-gpu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useStreamingRecording } from './hooks/useStreamingRecording';
import { useAnalysisWorker } from './hooks/useAnalysisWorker';
import { useIsMobile } from './hooks/useIsMobile';
import { useTheme } from './hooks/useTheme';
import { BottomSheet } from './components/BottomSheet';
import { defaultAnalysisSettings, defaultFilterSettings, createEmptyTextGrid } from './audio/defaults';
import { AudioEditorHistory, ReplaceRangeCommand } from './audio/editor';
import { applyBiquadFilter } from './audio/filters';
import { computeRhythmMetrics } from './audio/rhythm';
import { loadAudioFile } from './audio/recorder';
import { computeSpectrumSlice } from './audio/spectrum';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { AboutDialog } from "./components/AboutDialog";
import { MenuBar } from './components/MenuBar';
import { CommandPalette, Command } from './components/CommandPalette';
import { RhythmPanel } from './components/RhythmPanel';
import { RightSidebar } from './components/RightSidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { Spectrogram } from './components/Spectrogram';
import { Cochleagram } from './components/Cochleagram';
import { SpectrumSlice } from './components/SpectrumSlice';
import { StatusBar } from './components/StatusBar';
import { TextGridEditor } from './components/TextGridEditor';
import { TimeRuler } from './components/TimeRuler';
import { Toolbar } from './components/Toolbar';
import { HarmonicityPanel } from './components/HarmonicityPanel';
import ManipulationEditor from './components/ManipulationEditor';
import PitchTierEditor from './components/PitchTierEditor';
import FormantGridEditor from './components/FormantGridEditor';
import DurationTierEditor from './components/DurationTierEditor';
import AmplitudeTierEditor from './components/AmplitudeTierEditor';
import { VocalTractEditor } from './components/VocalTractEditor';
import { SpectrumEditor } from './components/SpectrumEditor';
import { ExperimentDesigner } from './components/ExperimentDesigner';
import { ExperimentMFC } from './components/ExperimentMFC';
import { ScriptEditor } from './components/ScriptEditor';
import { VoiceQualityPanel } from './components/VoiceQualityPanel';
import { Waveform } from './components/Waveform';
import { DropOverlay, DropFileType } from './components/DropOverlay';
import { Minimap } from './components/Minimap';
import { FilterPanel } from './components/FilterPanel';
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
import { addPointToTier, addTier, deleteBoundary, deletePoint, moveBoundary, movePoint, moveTier, parseTextGrid, removeTier, renameTier, splitIntervalTierBoundary, updateTextGridLabel } from './textgrid/parser';
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
  const isMobile = useIsMobile();
  const { setting: themeSetting, setTheme: setThemeSetting } = useTheme();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selection, setSelection] = useState<TimeSelection | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPitch, setShowPitch] = useState(true);
  const [showFormants, setShowFormants] = useState(true);
  const [showIntensity, setShowIntensity] = useState(true);
  const [showIpa, setShowIpa] = useState(true);
  const [showCochleagram, setShowCochleagram] = useState(false);
  const [showManipulation, setShowManipulation] = useState(false);
  const [showPitchTier, setShowPitchTier] = useState(false);
  const [showFormantGrid, setShowFormantGrid] = useState(false);
  const [showDurationTier, setShowDurationTier] = useState(false);
  const [showAmplitudeTier, setShowAmplitudeTier] = useState(false);
  const [showVocalTract, setShowVocalTract] = useState(false);
  const [showSpectrumEditor, setShowSpectrumEditor] = useState(false);
  const [showExperiment, setShowExperiment] = useState(false);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [experimentConfig, setExperimentConfig] = useState<{ config: any; audioMap: Record<string, string> } | null>(null);
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
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const textGridFileInputRef = useRef<HTMLInputElement>(null);
  const textGridRef = useRef<TextGrid>(createEmptyTextGrid(1));

  const viewRange = useMemo(() => ({ start: viewStart, end: viewEnd }), [viewStart, viewEnd]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(editorRef.current.canUndo());
    setCanRedo(editorRef.current.canRedo());
  }, []);

  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const processSamples = useCallback(
    (samples: Float32Array, nextSampleRate: number, resetEditor = false) => {
      currentSamplesRef.current = Float32Array.from(samples);
      setSampleRate(nextSampleRate);
      setAnalyzing(true);
      setProgress(0);
      // Copy samples since we transfer the buffer to the worker
      const copy = Float32Array.from(samples);
      analyzeInWorker(copy, nextSampleRate, settingsRef.current, (v) => setProgress(v)).then((nextAnalysis) => {
        setAnalyzing(false);
        setProgress(100);
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

  // Preload WebGPU device at mount to avoid first-analysis delay
  useEffect(() => {
    initGpuFft();
  }, []);

  useEffect(() => {
    if (!currentSamplesRef.current) return;
    processSamples(currentSamplesRef.current, sampleRate, false);
  }, [processSamples, sampleRate, settings]);

  useEffect(() => {
    textGridRef.current = textGrid;
  }, [textGrid]);

  const handleLoadFile = useCallback(async (file: File) => {
    try {
      const buffer = await loadAudioFile(file);
      processAudioBuffer(buffer, true);
    } catch (err) {
      alert(`Failed to load audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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

    const startOffset = selection?.start ?? currentTime;
    const duration = selection ? selection.end - selection.start : undefined;
    source.start(0, startOffset, duration);
    sourceRef.current = source;
    playStartRef.current = ctx.currentTime - startOffset;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      // Stay at end position instead of jumping back to 0
      if (selection) {
        setCurrentTime(selection.end);
      }
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

  const handleViewRangeChange = useCallback((start: number, end: number) => {
    setViewStart(start);
    setViewEnd(end);
  }, []);

  const handleFitToWindow = useCallback(() => {
    if (!analysis) return;
    const next = fitToWindow(analysis.duration);
    setViewStart(next.start);
    setViewEnd(next.end);
  }, [analysis]);

  const handleSpectrumSliceSelect = useCallback((time: number) => {
    if (!currentSamplesRef.current || !analysis) return;
    setCurrentTime(time);
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

  const [isDragOver, setIsDragOver] = useState(false);
  const [dragFileType, setDragFileType] = useState<DropFileType>('audio');
  const dragCounterRef = useRef(0);

  const detectFileType = useCallback((event: DragEvent): DropFileType => {
    const items = event.dataTransfer?.items;
    if (items && items.length > 0) {
      const item = items[0];
      if (item.type.startsWith('audio/') || /\.(wav|mp3|flac|ogg)$/i.test(item.type)) return 'audio';
      // Can't reliably read filename from items during dragenter, check type
      if (item.type === '' || item.type === 'text/plain') return 'audio'; // default guess
    }
    return 'audio';
  }, []);

  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      // Only show drop overlay for external file drops, not internal boundary drags
      if (!event.dataTransfer?.types.includes('Files')) return;
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setDragFileType(detectFileType(event));
        setIsDragOver(true);
      }
    };
    const handleDragLeave = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragOver(false);
      }
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      if (file.name.endsWith('.TextGrid')) {
        void handleImportTextGrid(file);
      } else if (file.type.startsWith('audio/') || /\.(wav|mp3|flac|ogg)$/i.test(file.name)) {
        void handleLoadFile(file);
      }
    };
    const prevent = (event: DragEvent) => event.preventDefault();
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', prevent);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', prevent);
    };
  }, [handleImportTextGrid, handleLoadFile, detectFileType]);

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

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const mod = isMac ? '\u2318' : 'Ctrl+';
  const shift = isMac ? '\u21e7' : 'Shift+';

  const paletteCommands: Command[] = useMemo(() => [
    { id: 'file.open-audio', label: 'Open Audio', category: 'File', action: () => audioFileInputRef.current?.click() },
    { id: 'file.import-textgrid', label: 'Import TextGrid', category: 'File', action: () => textGridFileInputRef.current?.click() },
    { id: 'file.export-wav', label: 'Export WAV', category: 'File', action: () => { if (currentSamplesRef.current) downloadBinaryFile('audio.wav', exportSelectedRegionWav(currentSamplesRef.current, sampleRate)); } },
    { id: 'file.export-pitch-csv', label: 'Export Pitch CSV', category: 'File', action: () => { if (analysis) downloadTextFile('pitch.csv', exportPitchCsv(analysis.pitch), 'text/csv'); } },
    { id: 'file.export-formant-csv', label: 'Export Formant CSV', category: 'File', action: () => { if (analysis) downloadTextFile('formants.csv', exportFormantCsv(analysis.formants), 'text/csv'); } },
    { id: 'edit.undo', label: 'Undo', category: 'Edit', shortcut: `${mod}Z`, action: handleUndo },
    { id: 'edit.redo', label: 'Redo', category: 'Edit', shortcut: `${mod}${shift}Z`, action: handleRedo },
    { id: 'edit.cut', label: 'Cut', category: 'Edit', shortcut: `${mod}X`, action: handleCut },
    { id: 'edit.copy', label: 'Copy', category: 'Edit', shortcut: `${mod}C`, action: handleCopy },
    { id: 'edit.paste', label: 'Paste', category: 'Edit', shortcut: `${mod}V`, action: handlePaste },
    { id: 'edit.delete', label: 'Delete', category: 'Edit', shortcut: 'Del', action: handleDelete },
    { id: 'view.zoom-in', label: 'Zoom In', category: 'View', shortcut: `${mod}+`, action: handleZoomIn },
    { id: 'view.zoom-out', label: 'Zoom Out', category: 'View', shortcut: `${mod}\u2212`, action: handleZoomOut },
    { id: 'view.fit-to-window', label: 'Fit to Window', category: 'View', shortcut: `${mod}0`, action: handleFitToWindow },
    { id: 'view.toggle-pitch', label: 'Toggle Pitch', category: 'View', action: () => setShowPitch((v) => !v) },
    { id: 'view.toggle-formants', label: 'Toggle Formants', category: 'View', action: () => setShowFormants((v) => !v) },
    { id: 'view.toggle-intensity', label: 'Toggle Intensity', category: 'View', action: () => setShowIntensity((v) => !v) },
    { id: 'view.toggle-cochleagram', label: 'Toggle Cochleagram', category: 'View', action: () => setShowCochleagram((v) => !v) },
    { id: 'view.toggle-ipa', label: 'Toggle IPA', category: 'View', action: () => setShowIpa((v) => !v) },
    { id: 'view.theme-dark', label: 'Theme: Dark', category: 'View', action: () => setThemeSetting('dark') },
    { id: 'view.theme-light', label: 'Theme: Light', category: 'View', action: () => setThemeSetting('light') },
    { id: 'view.theme-hc-dark', label: 'Theme: HC Dark', category: 'View', action: () => setThemeSetting('hc-dark') },
    { id: 'view.theme-hc-light', label: 'Theme: HC Light', category: 'View', action: () => setThemeSetting('hc-light') },
    { id: 'tools.manipulation', label: 'Manipulation', category: 'Tools', action: () => setShowManipulation(true) },
    { id: 'tools.pitch-tier', label: 'Pitch Tier', category: 'Tools', action: () => setShowPitchTier(true) },
    { id: 'tools.formant-grid', label: 'Formant Grid', category: 'Tools', action: () => setShowFormantGrid(true) },
    { id: 'tools.duration-tier', label: 'Duration Tier', category: 'Tools', action: () => setShowDurationTier(true) },
    { id: 'tools.amplitude-tier', label: 'Amplitude Tier', category: 'Tools', action: () => setShowAmplitudeTier(true) },
    { id: 'tools.vocal-tract', label: 'Vocal Tract', category: 'Tools', action: () => setShowVocalTract(true) },
    { id: 'tools.spectrum-editor', label: 'Spectrum Editor', category: 'Tools', action: () => setShowSpectrumEditor(true) },
    { id: 'tools.experiment', label: 'Experiment', category: 'Tools', action: () => setShowExperiment(true) },
    { id: 'tools.script-editor', label: 'Script Editor', category: 'Tools', action: () => setShowScriptEditor(true) },
    { id: 'analysis.compute-hnr', label: 'Compute HNR', category: 'Analysis', action: () => {} },
    { id: 'analysis.compute-rhythm', label: 'Compute Rhythm', category: 'Analysis', action: () => {} },
    { id: 'analysis.voice-quality', label: 'Voice Quality', category: 'Analysis', action: () => {} },
    { id: 'recording.start-stop', label: 'Start/Stop Recording', category: 'Recording', shortcut: 'R', action: () => { isRecording ? handleStopRecord() : handleRecord(); } },
  ], [analysis, handleUndo, handleRedo, handleCut, handleCopy, handlePaste, handleDelete, handleZoomIn, handleZoomOut, handleFitToWindow, isRecording, handleRecord, handleStopRecord, sampleRate, mod, shift]);

  return (
    <div className="app-layout">
      <DropOverlay visible={isDragOver} fileType={dragFileType} />
      <input ref={audioFileInputRef} type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && handleLoadFile(e.target.files[0])} />
      <input ref={textGridFileInputRef} type="file" accept=".TextGrid,.textgrid,text/plain" hidden onChange={(e) => e.target.files?.[0] && handleImportTextGrid(e.target.files[0])} />
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
        onToggleIpa={() => setShowIpa((v) => !v)}
        showPitch={showPitch}
        showFormants={showFormants}
        showIntensity={showIntensity}
        showIpa={showIpa}
        showCochleagram={showCochleagram}
        onToggleCochleagram={() => setShowCochleagram((v) => !v)}
        onOpenManipulation={() => setShowManipulation(true)}
        onOpenPitchTier={() => setShowPitchTier(true)}
        onOpenFormantGrid={() => setShowFormantGrid(true)}
        onOpenDurationTier={() => setShowDurationTier(true)}
        onOpenAmplitudeTier={() => setShowAmplitudeTier(true)}
        onOpenVocalTract={() => setShowVocalTract(true)}
        onOpenSpectrumEditor={() => setShowSpectrumEditor(true)}
        onOpenExperiment={() => setShowExperiment(true)}
        onOpenScriptEditor={() => setShowScriptEditor(true)}
        themeSetting={themeSetting}
        onThemeChange={setThemeSetting}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <CommandPalette commands={paletteCommands} open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

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
        {!isMobile && (
          <Sidebar
            showPitch={showPitch}
            showFormants={showFormants}
            showIntensity={showIntensity}
            showIpa={showIpa}
            showCochleagram={showCochleagram}
            onTogglePitch={() => setShowPitch((value) => !value)}
            onToggleFormants={() => setShowFormants((value) => !value)}
            onToggleIntensity={() => setShowIntensity((value) => !value)}
            onToggleIpa={() => setShowIpa((value) => !value)}
            onToggleCochleagram={() => setShowCochleagram((value) => !value)}
          />
        )}

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
                onCursorChange={() => {}}
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
                showIpa={showIpa}
                onWheelZoom={() => {}}
                onPan={() => {}}
                onZoomSelection={() => {}}
                onSelectionChange={() => {}}
                onSpectrumSliceSelect={() => {}}
              />
            </>
          )}

          {analyzing && (
            <div className="w-full px-4 py-2">
              <div className="relative w-full h-1 bg-zinc-700 rounded overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all duration-200 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #1e40af, #059669)',
                  }}
                />
              </div>
              <p className="text-xs text-zinc-400 mt-1 text-center">Analyzing… {progress}%</p>
            </div>
          )}

          {analysis && (
            <>
              <div className="audio-visualizations">
              <TimeRuler duration={analysis.duration} viewRange={viewRange} />
              <Waveform
                analysis={analysis}
                selection={selection}
                currentTime={currentTime}
                viewRange={viewRange}
                onSelectionChange={setSelection}
                onCursorChange={setCurrentTime}
                onWheelZoom={handleWheelZoom}
                onPan={handlePan}
                onZoomSelection={handleZoomSelection}
              />
              <Minimap
                analysis={analysis}
                viewRange={viewRange}
                selection={selection}
                onViewRangeChange={handleViewRangeChange}
              />
              {showCochleagram ? (
                <Cochleagram
                  analysis={analysis}
                  viewRange={viewRange}
                />
              ) : (
                <Spectrogram
                  analysis={analysis}
                  selection={selection}
                  currentTime={currentTime}
                  viewRange={viewRange}
                  showPitch={showPitch}
                  showFormants={showFormants}
                  showIntensity={showIntensity}
                  showIpa={showIpa}
                  onWheelZoom={handleWheelZoom}
                  onPan={handlePan}
                  onZoomSelection={handleZoomSelection}
                  onSelectionChange={setSelection}
                  onSpectrumSliceSelect={handleSpectrumSliceSelect}
                />
              )}
              </div>
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
                onMoveTier={(tierId, direction) => setTextGrid((current) => moveTier(current, tierId, direction))}
              />
            </>
          )}
        </div>

        </main>

        {analysis && !isMobile && (
          <RightSidebar>
            {{
              spectrum: <SpectrumSlice slice={analysis.spectrumSlice} />,
              voice: <VoiceQualityPanel metrics={analysis.voiceQuality} />,
              hnr: <HarmonicityPanel data={analysis.harmonicity} viewStart={viewStart} viewEnd={viewEnd} />,
              rhythm: <RhythmPanel metrics={rhythmMetrics} />,
              settings: (
                <>
                  <SettingsPanel settings={settings} onChange={setSettings} />
                  <FilterPanel settings={filterSettings} onChange={setFilterSettings} onApply={handleApplyFilter} onReset={handleResetFilter} />
                </>
              ),
            }}
          </RightSidebar>
        )}
      </div>

      {isMobile && (
        <BottomSheet trigger="⚙️">
          <div className="bottom-sheet-content">
            <div className="sidebar-section">
              <h3>Overlays</h3>
              <label className="toggle-label">
                <input type="checkbox" checked={showPitch} onChange={() => setShowPitch((v) => !v)} />
                <span className="toggle-indicator pitch" />
                Pitch
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={showFormants} onChange={() => setShowFormants((v) => !v)} />
                <span className="toggle-indicator formants" />
                Formants
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={showIntensity} onChange={() => setShowIntensity((v) => !v)} />
                <span className="toggle-indicator intensity" />
                Intensity
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={showIpa} onChange={() => setShowIpa((v) => !v)} />
                <span className="toggle-indicator ipa" />
                IPA Vowels
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={showCochleagram} onChange={() => setShowCochleagram((v) => !v)} />
                <span className="toggle-indicator" style={{ backgroundColor: '#94e2d5' }} />
                Cochleagram
              </label>
            </div>
            {analysis && (
              <div className="sidebar-section">
                <h3>Settings</h3>
                <SettingsPanel settings={settings} onChange={setSettings} />
                <FilterPanel settings={filterSettings} onChange={setFilterSettings} onApply={handleApplyFilter} onReset={handleResetFilter} />
              </div>
            )}
          </div>
        </BottomSheet>
      )}

      <StatusBar
        hasAudio={!!analysis}
        duration={analysis?.duration ?? 0}
        selection={selection}
        sampleRate={sampleRate}
        isRecording={isRecording}
        streamDuration={streaming.streamDuration}
      />
      <KeyboardShortcutsDialog />
      <AboutDialog />

      {/* Tool Panels */}
      {showManipulation && currentSamplesRef.current && (
        <div className="modal-overlay" onClick={() => setShowManipulation(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowManipulation(false)}>✕</button>
            <ManipulationEditor samples={currentSamplesRef.current} sampleRate={sampleRate} onSynthesized={(output) => { commitSamples(output); setShowManipulation(false); }} />
          </div>
        </div>
      )}
      {showPitchTier && currentSamplesRef.current && (
        <div className="modal-overlay" onClick={() => setShowPitchTier(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPitchTier(false)}>✕</button>
            <PitchTierEditor samples={currentSamplesRef.current} sampleRate={sampleRate} onApply={() => setShowPitchTier(false)} />
          </div>
        </div>
      )}
      {showFormantGrid && analysis && (
        <div className="modal-overlay" onClick={() => setShowFormantGrid(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFormantGrid(false)}>✕</button>
            <FormantGridEditor duration={analysis.duration} onApply={() => setShowFormantGrid(false)} />
          </div>
        </div>
      )}
      {showDurationTier && analysis && (
        <div className="modal-overlay" onClick={() => setShowDurationTier(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDurationTier(false)}>✕</button>
            <DurationTierEditor duration={analysis.duration} onApply={() => setShowDurationTier(false)} />
          </div>
        </div>
      )}
      {showAmplitudeTier && analysis && (
        <div className="modal-overlay" onClick={() => setShowAmplitudeTier(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAmplitudeTier(false)}>✕</button>
            <AmplitudeTierEditor duration={analysis.duration} onApply={() => setShowAmplitudeTier(false)} />
          </div>
        </div>
      )}
      {showVocalTract && (
        <div className="modal-overlay" onClick={() => setShowVocalTract(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowVocalTract(false)}>✕</button>
            <VocalTractEditor />
          </div>
        </div>
      )}
      {showSpectrumEditor && (
        <div className="modal-overlay" onClick={() => setShowSpectrumEditor(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSpectrumEditor(false)}>✕</button>
            <SpectrumEditor slice={analysis?.spectrumSlice ?? null} samples={currentSamplesRef.current ?? null} sampleRate={sampleRate} onApplyFilter={(filtered) => { commitSamples(filtered); setShowSpectrumEditor(false); }} />
          </div>
        </div>
      )}
      {showExperiment && !experimentConfig && (
        <div className="modal-overlay" onClick={() => setShowExperiment(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowExperiment(false)}>✕</button>
            <ExperimentDesigner onStart={(config, audioMap) => setExperimentConfig({ config, audioMap })} />
          </div>
        </div>
      )}
      {showExperiment && experimentConfig && (
        <div className="modal-overlay" onClick={() => { setShowExperiment(false); setExperimentConfig(null); }}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowExperiment(false); setExperimentConfig(null); }}>✕</button>
            <ExperimentMFC config={experimentConfig.config} audioMap={experimentConfig.audioMap} onComplete={() => { setShowExperiment(false); setExperimentConfig(null); }} />
          </div>
        </div>
      )}
      {showScriptEditor && (
        <div className="modal-overlay" onClick={() => setShowScriptEditor(false)}>
          <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowScriptEditor(false)}>✕</button>
            <ScriptEditor samples={currentSamplesRef.current ?? undefined} sampleRate={sampleRate} />
          </div>
        </div>
      )}
    </div>
  );
}
