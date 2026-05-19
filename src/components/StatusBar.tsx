interface StatusBarProps {
  hasAudio: boolean;
  duration: number;
  selection: { start: number; end: number } | null;
  sampleRate: number;
  isRecording: boolean;
  streamDuration?: number;
}

export function StatusBar({ hasAudio, duration, selection, sampleRate, isRecording, streamDuration }: StatusBarProps) {
  const fmt = (t: number) => t.toFixed(3) + 's';

  return (
    <footer className="statusbar" role="status" aria-label="Status bar">
      {isRecording && (
        <span className="statusbar-item statusbar-recording">
          <span className="recording-dot" /> REC {streamDuration != null ? fmt(streamDuration) : ''}
        </span>
      )}
      {hasAudio && (
        <>
          <span className="statusbar-item">Duration: {fmt(duration)}</span>
          <span className="statusbar-item">Sample Rate: {sampleRate} Hz</span>
          {selection && (
            <span className="statusbar-item">
              Selection: {fmt(selection.start)} – {fmt(selection.end)} ({fmt(selection.end - selection.start)})
            </span>
          )}
        </>
      )}
      {!hasAudio && !isRecording && (
        <span className="statusbar-item statusbar-hint">Drop an audio file or press Record to begin</span>
      )}
    </footer>
  );
}
