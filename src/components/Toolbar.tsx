import {
  Play, Pause, Square, Circle, ZoomIn, ZoomOut, Maximize,
  Scissors, Copy, ClipboardPaste, Trash2, Undo2, Redo2,
  AudioLines, Waves, Activity, Languages, Ear,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface ToolbarProps {
  hasAudio: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  selection: { start: number; end: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onRecord: () => void;
  onStopRecord: () => void;
  onPlay: () => void;
  onPause: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
  // Overlay toggles
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
  showIpa: boolean;
  showCochleagram: boolean;
  onTogglePitch: () => void;
  onToggleFormants: () => void;
  onToggleIntensity: () => void;
  onToggleIpa: () => void;
  onToggleCochleagram: () => void;
}

function IconBtn({ icon: Icon, label, onClick, disabled, active, danger, color }: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  color?: string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`toolbar-btn${active ? ' toolbar-btn-active' : ''}${danger ? ' toolbar-btn-danger' : ''}`}
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            style={active && color ? { color, borderColor: color } : undefined}
          >
            <Icon size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Toolbar(props: ToolbarProps) {
  const {
    hasAudio, isPlaying, isRecording, selection, canUndo, canRedo,
    onRecord, onStopRecord, onPlay, onPause,
    onUndo, onRedo, onCut, onCopy, onPaste, onDelete,
    onZoomIn, onZoomOut, onFitToWindow,
    showPitch, showFormants, showIntensity, showIpa, showCochleagram,
    onTogglePitch, onToggleFormants, onToggleIntensity, onToggleIpa, onToggleCochleagram,
  } = props;

  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      <div className="toolbar-group">
        <IconBtn
          icon={isRecording ? Square : Circle}
          label={isRecording ? 'Stop Recording' : 'Record'}
          onClick={isRecording ? onStopRecord : onRecord}
          danger={!isRecording}
          active={isRecording}
        />
        <IconBtn
          icon={isPlaying ? Pause : Play}
          label={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}
          disabled={!hasAudio}
        />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <IconBtn icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
        <IconBtn icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo} />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <IconBtn icon={Scissors} label="Cut" onClick={onCut} disabled={!selection} />
        <IconBtn icon={Copy} label="Copy" onClick={onCopy} disabled={!selection} />
        <IconBtn icon={ClipboardPaste} label="Paste" onClick={onPaste} disabled={!hasAudio} />
        <IconBtn icon={Trash2} label="Delete" onClick={onDelete} disabled={!selection} />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <IconBtn icon={ZoomIn} label="Zoom In" onClick={onZoomIn} />
        <IconBtn icon={ZoomOut} label="Zoom Out" onClick={onZoomOut} />
        <IconBtn icon={Maximize} label="Fit to Window" onClick={onFitToWindow} disabled={!hasAudio} />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <IconBtn icon={AudioLines} label="Pitch" onClick={onTogglePitch} active={showPitch} color="#89b4fa" />
        <IconBtn icon={Waves} label="Formants" onClick={onToggleFormants} active={showFormants} color="#f38ba8" />
        <IconBtn icon={Activity} label="Intensity" onClick={onToggleIntensity} active={showIntensity} color="#a6e3a1" />
        <IconBtn icon={Languages} label="IPA Vowels" onClick={onToggleIpa} active={showIpa} color="#fab387" />
        <IconBtn icon={Ear} label="Cochleagram" onClick={onToggleCochleagram} active={showCochleagram} color="#94e2d5" />
      </div>
    </div>
  );
}
