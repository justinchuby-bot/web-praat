import { useState } from 'react';
import { Settings2, Music, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import type { AnalysisSettings, ColormapName, WindowFunction } from '../types';

interface SettingsPanelProps {
  settings: AnalysisSettings;
  onChange: (settings: AnalysisSettings) => void;
}

const FFT_SIZES = [256, 512, 1024, 2048, 4096] as const;
const WINDOW_FUNCTIONS: { value: WindowFunction; label: string }[] = [
  { value: 'hanning', label: 'Hanning' },
  { value: 'hamming', label: 'Hamming' },
  { value: 'gaussian', label: 'Gaussian' },
  { value: 'bartlett', label: 'Bartlett' },
  { value: 'rectangular', label: 'Rectangular' },
];
const COLORMAPS: { value: ColormapName; label: string }[] = [
  { value: 'jet', label: 'Jet' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'viridis', label: 'Viridis' },
  { value: 'magma', label: 'Magma' },
];

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number }>; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-section">
      <button
        type="button"
        className="settings-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Icon size={14} />
        <span className="settings-section-title">{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="settings-grid">{children}</div>}
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const updateSpectrogram = (patch: Partial<AnalysisSettings['spectrogram']>) => {
    onChange({ ...settings, spectrogram: { ...settings.spectrogram, ...patch } });
  };
  const updatePitch = (patch: Partial<AnalysisSettings['pitch']>) => {
    onChange({ ...settings, pitch: { ...settings.pitch, ...patch } });
  };
  const updateFormant = (patch: Partial<AnalysisSettings['formant']>) => {
    onChange({ ...settings, formant: { ...settings.formant, ...patch } });
  };

  return (
    <div className="sidebar-section">
      <Section title="Spectrogram" icon={Settings2}>
        <label className="settings-field">
          <span>Window function</span>
          <select
            value={settings.spectrogram.windowFunction}
            onChange={(e) => updateSpectrogram({ windowFunction: e.target.value as WindowFunction })}
          >
            {WINDOW_FUNCTIONS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>FFT size</span>
          <select
            value={settings.spectrogram.fftSize}
            onChange={(e) => updateSpectrogram({ fftSize: Number(e.target.value) as typeof settings.spectrogram.fftSize })}
          >
            {FFT_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Hop size</span>
          <input
            type="number"
            min={32}
            max={2048}
            step={32}
            value={settings.spectrogram.hopSize}
            onChange={(e) => updateSpectrogram({ hopSize: Number(e.target.value) })}
          />
        </label>

        <label className="settings-field">
          <span>Dynamic range (dB)</span>
          <input
            type="number"
            min={20}
            max={120}
            step={5}
            value={settings.spectrogram.dynamicRangeDb}
            onChange={(e) => updateSpectrogram({ dynamicRangeDb: Number(e.target.value) })}
          />
        </label>

        <label className="settings-field">
          <span>Max view frequency (Hz)</span>
          <input
            type="number"
            min={500}
            max={22050}
            step={500}
            value={settings.spectrogram.maxViewFrequency}
            onChange={(e) => updateSpectrogram({ maxViewFrequency: Number(e.target.value) })}
          />
        </label>

        <label className="settings-field">
          <span>Pre-emphasis (dB/oct)</span>
          <input
            type="number"
            min={0}
            max={12}
            step={1}
            value={settings.spectrogram.preEmphasis}
            onChange={(e) => updateSpectrogram({ preEmphasis: Number(e.target.value) })}
          />
        </label>

        <label className="settings-field">
          <span>Colormap</span>
          <select
            value={settings.spectrogram.colormap}
            onChange={(e) => updateSpectrogram({ colormap: e.target.value as ColormapName })}
          >
            {COLORMAPS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Pitch" icon={Music}>
        <label className="settings-field">
          <span>Min Hz</span>
          <input
            type="number"
            min={30}
            max={500}
            value={settings.pitch.minHz}
            onChange={(e) => updatePitch({ minHz: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Max Hz</span>
          <input
            type="number"
            min={100}
            max={2000}
            value={settings.pitch.maxHz}
            onChange={(e) => updatePitch({ maxHz: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Voicing threshold</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={settings.pitch.voicingThreshold}
            onChange={(e) => updatePitch({ voicingThreshold: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Silence threshold</span>
          <input
            type="number"
            step={0.01}
            min={0}
            max={1}
            value={settings.pitch.silenceThreshold}
            onChange={(e) => updatePitch({ silenceThreshold: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Octave cost</span>
          <input
            type="number"
            step={0.005}
            min={0}
            max={1}
            value={settings.pitch.octaveCost}
            onChange={(e) => updatePitch({ octaveCost: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Octave-jump cost</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={2}
            value={settings.pitch.octaveJumpCost}
            onChange={(e) => updatePitch({ octaveJumpCost: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Voiced/unvoiced cost</span>
          <input
            type="number"
            step={0.01}
            min={0}
            max={2}
            value={settings.pitch.voicedUnvoicedCost}
            onChange={(e) => updatePitch({ voicedUnvoicedCost: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Max candidates</span>
          <input
            type="number"
            step={1}
            min={2}
            max={30}
            value={settings.pitch.maxCandidates}
            onChange={(e) => updatePitch({ maxCandidates: Number(e.target.value) })}
          />
        </label>
      </Section>

      <Section title="Formant" icon={BarChart3}>
        <label className="settings-field">
          <span>Max frequency (Hz)</span>
          <input
            type="number"
            min={3000}
            max={8000}
            step={500}
            value={settings.formant.maxFrequency}
            onChange={(e) => updateFormant({ maxFrequency: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>LPC order</span>
          <input
            type="number"
            min={6}
            max={24}
            value={settings.formant.lpcOrder}
            onChange={(e) => updateFormant({ lpcOrder: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Number of formants</span>
          <input
            type="number"
            min={1}
            max={5}
            value={settings.formant.numberOfFormants}
            onChange={(e) => updateFormant({ numberOfFormants: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Smoothing window (ms)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={settings.formant.smoothingWindowMs}
            onChange={(e) => updateFormant({ smoothingWindowMs: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Transition cost weight</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={settings.formant.transitionCostWeight}
            onChange={(e) => updateFormant({ transitionCostWeight: Number(e.target.value) })}
          />
        </label>
        <label className="settings-field">
          <span>Median filter size</span>
          <input
            type="number"
            min={1}
            max={9}
            step={2}
            value={settings.formant.medianFilterSize}
            onChange={(e) => updateFormant({ medianFilterSize: Number(e.target.value) })}
          />
        </label>
      </Section>
    </div>
  );
}
