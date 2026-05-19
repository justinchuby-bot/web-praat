import type { TimeSelection } from '../types';

interface ControlsProps {
  hasAudio: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  selection: TimeSelection | null;
  duration: number;
  canUndo: boolean;
  canRedo: boolean;
  onRecord: () => void;
  onStopRecord: () => void;
  onPlay: () => void;
  onPause: () => void;
  onLoadFile: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onFitToWindow: () => void;
  onZoomToSelection: () => void;
  onImportTextGrid: (file: File) => void;
  onExportTextGrid: () => void;
  onExportPitchCsv: () => void;
  onExportFormantCsv: () => void;
  onExportIntensityCsv: () => void;
  onExportSelectionWav: () => void;
  onExportFullWav: () => void;
  onExportHarmonicityCsv: () => void;
}

export function Controls({
  hasAudio,
  isPlaying,
  isRecording,
  selection,
  duration,
  canUndo,
  canRedo,
  onRecord,
  onStopRecord,
  onPlay,
  onPause,
  onLoadFile,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onFitToWindow,
  onZoomToSelection,
  onImportTextGrid,
  onExportTextGrid,
  onExportPitchCsv,
  onExportFormantCsv,
  onExportIntensityCsv,
  onExportSelectionWav,
  onExportFullWav,
  onExportHarmonicityCsv,
}: ControlsProps) {
  const formatTime = (time: number) => `${time.toFixed(3)}s`;

  return (
    <div className="controls" role="toolbar" aria-label="Audio controls">
      <div className="controls-group controls-wrap">
        <button className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`} onClick={isRecording ? onStopRecord : onRecord} aria-label={isRecording ? 'Stop recording' : 'Start recording'}>
          {isRecording ? 'Stop' : 'Record'}
        </button>
        <button className="btn btn-primary" disabled={!hasAudio} onClick={isPlaying ? onPause : onPlay} aria-label={isPlaying ? 'Pause playback' : 'Play audio'}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <label className="btn btn-secondary file-label">
          Open Audio
          <input hidden type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && onLoadFile(event.target.files[0])} />
        </label>
        <label className="btn btn-secondary file-label">
          Import TextGrid
          <input hidden type="file" accept=".TextGrid,.textgrid,text/plain" onChange={(event) => event.target.files?.[0] && onImportTextGrid(event.target.files[0])} />
        </label>
        <button className="btn btn-secondary" disabled={!selection} onClick={onZoomToSelection}>
          Zoom Selection
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onFitToWindow}>
          Fit
        </button>
        <button className="btn btn-secondary" disabled={!selection} onClick={onCut}>
          Cut
        </button>
        <button className="btn btn-secondary" disabled={!selection} onClick={onCopy}>
          Copy
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onPaste}>
          Paste
        </button>
        <button className="btn btn-secondary" disabled={!selection} onClick={onDelete}>
          Delete
        </button>
        <button className="btn btn-secondary" disabled={!canUndo} onClick={onUndo}>
          Undo
        </button>
        <button className="btn btn-secondary" disabled={!canRedo} onClick={onRedo}>
          Redo
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onExportTextGrid}>
          Export TextGrid
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onExportPitchCsv}>
          Pitch CSV
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onExportFormantCsv}>
          Formant CSV
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onExportIntensityCsv}>
          Intensity CSV
        </button>
        <button className="btn btn-secondary" disabled={!selection} onClick={onExportSelectionWav}>
          Selection WAV
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onExportFullWav}>
          Export WAV
        </button>
        <button className="btn btn-secondary" disabled={!hasAudio} onClick={onExportHarmonicityCsv}>
          HNR CSV
        </button>
      </div>
      <div className="controls-info">
        {hasAudio && (
          <span className="info-text">
            Duration: {formatTime(duration)}
            {selection ? ` | Selection: ${formatTime(selection.start)} - ${formatTime(selection.end)}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
