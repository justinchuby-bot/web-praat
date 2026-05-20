import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from './ui/menubar';
import type { ThemeSetting } from '../themes';
import { themeLabels } from '../themes';

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
  onToggleIpa: () => void;
  onToggleCochleagram: () => void;
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
  showIpa: boolean;
  showCochleagram: boolean;
  onOpenManipulation?: () => void;
  onOpenPitchTier?: () => void;
  onOpenFormantGrid?: () => void;
  onOpenDurationTier?: () => void;
  onOpenAmplitudeTier?: () => void;
  onOpenVocalTract?: () => void;
  onOpenSpectrumEditor?: () => void;
  onOpenExperiment?: () => void;
  onOpenSpeechSynthesizer?: () => void;
  onOpenPitchSonification?: () => void;
  onOpenNoteTranscription?: () => void;
  onOpenScriptEditor?: () => void;
  onOpenPlugins?: () => void;
  onOpenControlledVocabulary?: () => void;
  onOpenCommandPalette?: () => void;
  themeSetting?: ThemeSetting;
  onThemeChange?: (theme: ThemeSetting) => void;
  // Pulses menu
  showPulses?: boolean;
  onTogglePulses?: () => void;
  onShowVoiceReport?: () => void;
  // Query menu
  onGetCursorPosition?: () => void;
  onGetSelectionBounds?: () => void;
  onGetPitchAtCursor?: () => void;
  onGetFormantAtCursor?: () => void;
  onGetSpectralPowerAtCursor?: () => void;
  onGetIntensityAtCursor?: () => void;
  onGetHnrAtCursor?: () => void;
  onPitchListing?: () => void;
  onFormantListing?: () => void;
  // Select menu
  onSelectAll?: () => void;
  onMoveCursorToZeroCrossing?: () => void;
  onMoveStartToZeroCrossing?: () => void;
  onMoveEndToZeroCrossing?: () => void;
  // Pulses extended
  onGetJitterLocal?: () => void;
  onGetShimmerLocal?: () => void;
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
    onTogglePitch, onToggleFormants, onToggleIntensity, onToggleIpa, onToggleCochleagram,
    showPitch, showFormants, showIntensity, showIpa, showCochleagram,
    onOpenManipulation, onOpenPitchTier, onOpenFormantGrid,
    onOpenDurationTier, onOpenAmplitudeTier, onOpenVocalTract,
    onOpenSpectrumEditor, onOpenExperiment, onOpenSpeechSynthesizer, onOpenPitchSonification, onOpenNoteTranscription, onOpenScriptEditor, onOpenPlugins, onOpenControlledVocabulary,
    onOpenCommandPalette,
    themeSetting, onThemeChange,
  } = props;

  const themeOptions: ThemeSetting[] = ['dark', 'light', 'hc-dark', 'hc-light', 'auto'];

  return (
    <div className="menubar-row">
    <Menubar>
      {/* File */}
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem asChild>
            <FileInput accept="audio/*" onFile={onLoadFile}>Open Audio…</FileInput>
          </MenubarItem>
          <MenubarItem asChild>
            <FileInput accept=".TextGrid,.textgrid,text/plain" onFile={onImportTextGrid}>Import TextGrid…</FileInput>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasAudio} onClick={onExportFullWav}>Export WAV</MenubarItem>
          <MenubarItem disabled={!selection} onClick={onExportSelectionWav}>Export Selection WAV</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onExportTextGrid}>Export TextGrid</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasAudio} onClick={onExportPitchCsv}>Export Pitch CSV</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onExportFormantCsv}>Export Formant CSV</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onExportIntensityCsv}>Export Intensity CSV</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onExportHarmonicityCsv}>Export HNR CSV</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Edit */}
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled={!canUndo} onClick={onUndo}>Undo <span className="menu-shortcut">⌘Z</span></MenubarItem>
          <MenubarItem disabled={!canRedo} onClick={onRedo}>Redo <span className="menu-shortcut">⇧⌘Z</span></MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!selection} onClick={onCut}>Cut <span className="menu-shortcut">⌘X</span></MenubarItem>
          <MenubarItem disabled={!selection} onClick={onCopy}>Copy <span className="menu-shortcut">⌘C</span></MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onPaste}>Paste <span className="menu-shortcut">⌘V</span></MenubarItem>
          <MenubarItem disabled={!selection} onClick={onDelete}>Delete <span className="menu-shortcut">⌫</span></MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* View */}
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onZoomIn}>Zoom In <span className="menu-shortcut">⌘+</span></MenubarItem>
          <MenubarItem onClick={onZoomOut}>Zoom Out <span className="menu-shortcut">⌘-</span></MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onFitToWindow}>Fit to Window <span className="menu-shortcut">⌘0</span></MenubarItem>
          <MenubarItem disabled={!selection} onClick={onZoomToSelection}>Zoom to Selection</MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Theme</MenubarSubTrigger>
            <MenubarSubContent>
              {themeOptions.map((t) => (
                <MenubarItem key={t} onClick={() => onThemeChange?.(t)}>
                  {themeSetting === t ? '◉ ' : '○ '}{themeLabels[t]}
                </MenubarItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>

      {/* Analysis */}
      <MenubarMenu>
        <MenubarTrigger>Analysis</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onTogglePitch}>
            {showPitch ? '✓ ' : ''}Pitch Overlay
          </MenubarItem>
          <MenubarItem onClick={onToggleFormants}>
            {showFormants ? '✓ ' : ''}Formant Overlay
          </MenubarItem>
          <MenubarItem onClick={onToggleIntensity}>
            {showIntensity ? '✓ ' : ''}Intensity Overlay
          </MenubarItem>
          <MenubarItem onClick={onToggleIpa}>
            {showIpa ? '✓ ' : ''}IPA Vowel Labels
          </MenubarItem>
          <MenubarItem onClick={onToggleCochleagram}>
            {showCochleagram ? '✓ ' : ''}Cochleagram (Bark)
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Tools */}
      <MenubarMenu>
        <MenubarTrigger>Tools</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled={!hasAudio} onClick={onOpenManipulation}>Manipulation Editor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onOpenPitchTier}>Pitch Tier Editor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onOpenFormantGrid}>Formant Grid Editor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onOpenDurationTier}>Duration Tier Editor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onOpenAmplitudeTier}>Amplitude Tier Editor</MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onOpenVocalTract}>Vocal Tract Editor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={onOpenSpectrumEditor}>Spectrum Editor</MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onOpenExperiment}>Experiment (MFC)</MenubarItem>
          <MenubarItem onClick={onOpenSpeechSynthesizer}>SpeechSynthesizer (TTS)</MenubarItem>
          <MenubarItem onClick={onOpenPitchSonification}>Pitch Sonification</MenubarItem>
          <MenubarItem onClick={onOpenNoteTranscription}>Note Transcription</MenubarItem>
                    <MenubarItem onClick={onOpenScriptEditor}>Script Editor</MenubarItem>
          <MenubarItem onClick={onOpenPlugins}>🧩 Plugins</MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onOpenControlledVocabulary}>Controlled Vocabulary</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Pulses */}
      <MenubarMenu>
        <MenubarTrigger>Pulses</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={props.onTogglePulses}>
            {props.showPulses ? '✓ ' : ''}Show pulses
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasAudio} onClick={props.onShowVoiceReport}>Voice report</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasAudio} onClick={props.onGetJitterLocal}>Jitter (local)</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={props.onGetShimmerLocal}>Shimmer (local)</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Query */}
      <MenubarMenu>
        <MenubarTrigger>Query</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled={!hasAudio} onClick={props.onGetCursorPosition}>Get cursor position</MenubarItem>
          <MenubarItem disabled={!selection} onClick={props.onGetSelectionBounds}>Get selection bounds</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasAudio} onClick={props.onGetPitchAtCursor}>Get pitch at cursor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={props.onGetFormantAtCursor}>Get formant at cursor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={props.onGetSpectralPowerAtCursor}>Get spectral power at cursor <span className="menu-shortcut">F9</span></MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={props.onGetIntensityAtCursor}>Get intensity at cursor</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={props.onGetHnrAtCursor}>Get HNR at cursor</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasAudio} onClick={props.onPitchListing}>Pitch listing</MenubarItem>
          <MenubarItem disabled={!hasAudio} onClick={props.onFormantListing}>Formant listing</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Select */}
      <MenubarMenu>
        <MenubarTrigger>Select</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled={!hasAudio} onClick={props.onSelectAll}>Select all</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasAudio} onClick={props.onMoveCursorToZeroCrossing}>Move cursor to nearest zero crossing</MenubarItem>
          <MenubarItem disabled={!selection} onClick={props.onMoveStartToZeroCrossing}>Move start to zero crossing</MenubarItem>
          <MenubarItem disabled={!selection} onClick={props.onMoveEndToZeroCrossing}>Move end to zero crossing</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Help */}
      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => document.dispatchEvent(new CustomEvent('open-shortcuts-dialog'))}>
            Keyboard Shortcuts
          </MenubarItem>
          <MenubarItem onClick={() => document.dispatchEvent(new CustomEvent('open-about-dialog'))}>
            About Web-Praat
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
    <button className="command-palette-trigger" onClick={onOpenCommandPalette} title="Command Palette (⌘⇧P)">
      ⌘⇧P
    </button>
    </div>
  );
}
