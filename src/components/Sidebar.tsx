interface SidebarProps {
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
  onTogglePitch: () => void;
  onToggleFormants: () => void;
  onToggleIntensity: () => void;
}

export function Sidebar({
  showPitch,
  showFormants,
  showIntensity,
  onTogglePitch,
  onToggleFormants,
  onToggleIntensity,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">Web Praat</h1>
        <span className="app-subtitle">Speech Analysis</span>
      </div>

      <div className="sidebar-section">
        <h3>Overlays</h3>
        <label className="toggle-label">
          <input type="checkbox" checked={showPitch} onChange={onTogglePitch} />
          <span className="toggle-indicator pitch" />
          Pitch (F0)
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={showFormants} onChange={onToggleFormants} />
          <span className="toggle-indicator formants" />
          Formants
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={showIntensity} onChange={onToggleIntensity} />
          <span className="toggle-indicator intensity" />
          Intensity
        </label>
      </div>

      <div className="sidebar-section">
        <h3>Help</h3>
        <p className="help-text">
          Drop an audio file or click Record to start.
          Click and drag on the waveform to select a time range.
        </p>
      </div>

      <div className="sidebar-footer">
        <span className="footer-text">
          No external DSP libraries — all algorithms from scratch.
        </span>
      </div>
    </aside>
  );
}
