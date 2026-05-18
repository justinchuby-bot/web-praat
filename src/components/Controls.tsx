import type { TimeSelection } from '../types';

interface ControlsProps {
  hasAudio: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  selection: TimeSelection | null;
  duration: number;
  onRecord: () => void;
  onStopRecord: () => void;
  onPlay: () => void;
  onPause: () => void;
  onLoadFile: (file: File) => void;
}

export function Controls({
  hasAudio,
  isPlaying,
  isRecording,
  selection,
  duration,
  onRecord,
  onStopRecord,
  onPlay,
  onPause,
  onLoadFile,
}: ControlsProps) {
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadFile(file);
  };

  const formatTime = (t: number) => t.toFixed(3) + 's';

  return (
    <div className="controls">
      <div className="controls-group">
        <button
          className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
          onClick={isRecording ? onStopRecord : onRecord}
        >
          {isRecording ? '⏹ Stop' : '⏺ Record'}
        </button>

        <button
          className="btn btn-primary"
          disabled={!hasAudio}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <label className="btn btn-secondary file-label">
          📂 Open File
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileInput}
            hidden
          />
        </label>
      </div>

      <div className="controls-info">
        {hasAudio && (
          <span className="info-text">
            Duration: {formatTime(duration)}
            {selection && (
              <> | Selection: {formatTime(selection.start)} – {formatTime(selection.end)}</>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
