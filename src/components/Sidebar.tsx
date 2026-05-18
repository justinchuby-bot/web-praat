import type { ReactNode } from 'react';

interface SidebarProps {
  showPitch: boolean;
  showFormants: boolean;
  showIntensity: boolean;
  onTogglePitch: () => void;
  onToggleFormants: () => void;
  onToggleIntensity: () => void;
  children?: ReactNode;
}

export function Sidebar({
  showPitch,
  showFormants,
  showIntensity,
  onTogglePitch,
  onToggleFormants,
  onToggleIntensity,
  children,
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
          Pitch
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

      {children}

      <div className="sidebar-section">
        <h3>Navigation</h3>
        <p className="help-text">
          Wheel to zoom. Shift-drag or middle-drag to pan. Ctrl-drag to zoom a region. Click the spectrogram for a spectrum slice.
        </p>
      </div>

      <div className="sidebar-footer">
        <span className="footer-text">No external DSP libraries. All analysis is implemented in TypeScript.</span>
      </div>
    </aside>
  );
}
