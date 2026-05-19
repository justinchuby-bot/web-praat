export type DropFileType = 'audio' | 'textgrid' | 'unsupported';

interface DropOverlayProps {
  visible: boolean;
  fileType: DropFileType;
}

export function DropOverlay({ visible, fileType }: DropOverlayProps) {
  const config = {
    audio: { icon: '🎵', text: 'Drop to open audio', color: 'var(--accent, #4a9eff)' },
    textgrid: { icon: '📝', text: 'Drop to import TextGrid', color: 'var(--accent, #4a9eff)' },
    unsupported: { icon: '⚠️', text: 'Unsupported file type', color: '#e74c3c' },
  }[fileType];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(74, 158, 255, 0.1)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 200ms ease',
      }}
    >
      <div
        style={{
          border: `3px dashed ${config.color}`,
          borderRadius: 16,
          padding: '48px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 48 }}>{config.icon}</span>
        <span style={{ fontSize: 24, fontWeight: 600, color: config.color }}>
          {config.text}
        </span>
        <span style={{ fontSize: 13, color: '#888' }}>
          .wav, .mp3, .flac, .ogg, .TextGrid
        </span>
      </div>
    </div>
  );
}
