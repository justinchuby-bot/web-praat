import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface MenuBarProps {
  hasAudio: boolean;
  selection: { start: number; end: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onLoadFile: (file: File) => void;
  onImportTextGrid: (file: File) => void;
  onExportTextGrid: () => void;
  onExportFullWav: () => void;
  onExportSelectionWav: () => void;
  onExportPitchCsv: () => void;
  onExportFormantCsv: () => void;
  onExportIntensityCsv: () => void;
  onExportHarmonicityCsv: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
  onZoomToSelection: () => void;
  onTogglePitch: () => void;
  onToggleFormants: () => void;
  onToggleIntensity: () => void;
  onToggleCochleagram: () => void;
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
  showCochleagram: boolean;
  onOpenManipulation?: () => void;
  onOpenPitchTier?: () => void;
  onOpenFormantGrid?: () => void;
  onOpenDurationTier?: () => void;
  onOpenAmplitudeTier?: () => void;
  onOpenVocalTract?: () => void;
  onOpenSpectrumEditor?: () => void;
  onOpenExperiment?: () => void;
  onOpenScriptEditor?: () => void;
}

function FileInput({ accept, onFile, children }: { accept: string; onFile: (f: File) => void; children: React.ReactNode }) {
  return (
    <label className="menu-file-label">
      {children}
      <input hidden type="file" accept={accept} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

export function MenuBar(props: MenuBarProps) {
  const {
    hasAudio, selection, canUndo, canRedo,
    onLoadFile, onImportTextGrid, onExportTextGrid, onExportFullWav, onExportSelectionWav,
    onExportPitchCsv, onExportFormantCsv, onExportIntensityCsv, onExportHarmonicityCsv,
    onUndo, onRedo, onCut, onCopy, onPaste, onDelete,
    onZoomIn, onZoomOut, onFitToWindow, onZoomToSelection,
    onTogglePitch, onToggleFormants, onToggleIntensity, onToggleCochleagram,
    showPitch, showFormants, showIntensity, showCochleagram,
    onOpenManipulation, onOpenPitchTier, onOpenFormantGrid,
    onOpenDurationTier, onOpenAmplitudeTier, onOpenVocalTract,
    onOpenSpectrumEditor, onOpenExperiment, onOpenScriptEditor,
  } = props;

  return (
    <nav className="menubar" role="menubar" aria-label="Application menu">
      {/* File */}
      <DropdownMenu>
        <DropdownMenuTrigger className="menubar-item">File</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <FileInput accept="audio/*" onFile={onLoadFile}>Open Audio…</FileInput>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <FileInput accept=".TextGrid,.textgrid,text/plain" onFile={onImportTextGrid}>Import TextGrid…</FileInput>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasAudio} onClick={onExportFullWav}>Export WAV</DropdownMenuItem>
          <DropdownMenuItem disabled={!selection} onClick={onExportSelectionWav}>Export Selection WAV</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onExportTextGrid}>Export TextGrid</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasAudio} onClick={onExportPitchCsv}>Export Pitch CSV</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onExportFormantCsv}>Export Formant CSV</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onExportIntensityCsv}>Export Intensity CSV</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onExportHarmonicityCsv}>Export HNR CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit */}
      <DropdownMenu>
        <DropdownMenuTrigger className="menubar-item">Edit</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={!canUndo} onClick={onUndo}>Undo <span className="menu-shortcut">⌘Z</span></DropdownMenuItem>
          <DropdownMenuItem disabled={!canRedo} onClick={onRedo}>Redo <span className="menu-shortcut">⇧⌘Z</span></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!selection} onClick={onCut}>Cut <span className="menu-shortcut">⌘X</span></DropdownMenuItem>
          <DropdownMenuItem disabled={!selection} onClick={onCopy}>Copy <span className="menu-shortcut">⌘C</span></DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onPaste}>Paste <span className="menu-shortcut">⌘V</span></DropdownMenuItem>
          <DropdownMenuItem disabled={!selection} onClick={onDelete}>Delete <span className="menu-shortcut">⌫</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View */}
      <DropdownMenu>
        <DropdownMenuTrigger className="menubar-item">View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onZoomIn}>Zoom In <span className="menu-shortcut">⌘+</span></DropdownMenuItem>
          <DropdownMenuItem onClick={onZoomOut}>Zoom Out <span className="menu-shortcut">⌘-</span></DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onFitToWindow}>Fit to Window <span className="menu-shortcut">⌘0</span></DropdownMenuItem>
          <DropdownMenuItem disabled={!selection} onClick={onZoomToSelection}>Zoom to Selection</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Analysis */}
      <DropdownMenu>
        <DropdownMenuTrigger className="menubar-item">Analysis</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onTogglePitch}>
            {showPitch ? '✓ ' : ''}Pitch Overlay
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleFormants}>
            {showFormants ? '✓ ' : ''}Formant Overlay
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleIntensity}>
            {showIntensity ? '✓ ' : ''}Intensity Overlay
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleCochleagram}>
            {showCochleagram ? '✓ ' : ''}Cochleagram (Bark)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tools */}
      <DropdownMenu>
        <DropdownMenuTrigger className="menubar-item">Tools</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={!hasAudio} onClick={onOpenManipulation}>Manipulation Editor</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onOpenPitchTier}>Pitch Tier Editor</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onOpenFormantGrid}>Formant Grid Editor</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onOpenDurationTier}>Duration Tier Editor</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onOpenAmplitudeTier}>Amplitude Tier Editor</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenVocalTract}>Vocal Tract Editor</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasAudio} onClick={onOpenSpectrumEditor}>Spectrum Editor</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenExperiment}>Experiment (MFC)</DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenScriptEditor}>Script Editor</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Help */}
      <DropdownMenu>
        <DropdownMenuTrigger className="menubar-item">Help</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent('open-shortcuts-dialog'))}>
            Keyboard Shortcuts
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent('open-about-dialog'))}>
            About Web-Praat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
