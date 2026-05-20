import { useState, useRef, useCallback, useEffect } from 'react';
import { Settings2, Music, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import type { AnalysisSettings, ColormapName, WindowFunction } from '../types';
import { SliderField } from './SliderField';

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
  const [local, setLocal] = useState(settings);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync external changes
  useEffect(() => { setLocal(settings); }, [settings]);

  const debouncedOnChange = useCallback((next: AnalysisSettings) => {
    setLocal(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), 400);
  }, [onChange]);

  const updateSpectrogram = (patch: Partial<AnalysisSettings['spectrogram']>) => {
    debouncedOnChange({ ...local, spectrogram: { ...local.spectrogram, ...patch } });
  };
  const updatePitch = (patch: Partial<AnalysisSettings['pitch']>) => {
    debouncedOnChange({ ...local, pitch: { ...local.pitch, ...patch } });
  };
  const updateFormant = (patch: Partial<AnalysisSettings['formant']>) => {
    debouncedOnChange({ ...local, formant: { ...local.formant, ...patch } });
  };

  return (
    <div className="sidebar-section">
      <Section title="Spectrogram" icon={Settings2}>
        <label className="settings-field">
          <span>Window function</span>
          <select
            value={local.spectrogram.windowFunction}
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
            value={local.spectrogram.fftSize}
            onChange={(e) => updateSpectrogram({ fftSize: Number(e.target.value) as typeof local.spectrogram.fftSize })}
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
            value={local.spectrogram.hopSize}
            onChange={(e) => updateSpectrogram({ hopSize: Number(e.target.value) })}
          />
        </label>

        <SliderField
          label="Dynamic range"
          value={local.spectrogram.dynamicRangeDb}
          min={20}
          max={120}
          step={5}
          unit=" dB"
          onChange={(v) => updateSpectrogram({ dynamicRangeDb: v })}
        />

        <SliderField
          label="Max frequency"
          value={local.spectrogram.maxViewFrequency}
          min={2000}
          max={22050}
          step={500}
          unit=" Hz"
          onChange={(v) => updateSpectrogram({ maxViewFrequency: v })}
        />

        <label className="settings-field">
          <span>Pre-emphasis (dB/oct)</span>
          <input
            type="number"
            min={0}
            max={12}
            step={1}
            value={local.spectrogram.preEmphasis}
            onChange={(e) => updateSpectrogram({ preEmphasis: Number(e.target.value) })}
          />
        </label>

        <label className="settings-field">
          <span>Colormap</span>
          <select
            value={local.spectrogram.colormap}
            onChange={(e) => updateSpectrogram({ colormap: e.target.value as ColormapName })}
          >
            {COLORMAPS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Pitch" icon={Music}>
        <SliderField
          label="Min pitch"
          value={local.pitch.minHz}
          min={30}
          max={300}
          step={5}
          unit=" Hz"
          onChange={(v) => updatePitch({ minHz: v })}
        />
        <SliderField
          label="Max pitch"
          value={local.pitch.maxHz}
          min={100}
          max={1000}
          step={10}
          unit=" Hz"
          onChange={(v) => updatePitch({ maxHz: v })}
        />
        <SliderField
          label="Voicing threshold"
          value={local.pitch.voicingThreshold}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => updatePitch({ voicingThreshold: v })}
        />
        <label className="settings-field">
          <span>Silence threshold</span>
          <input
            type="number"
            step={0.01}
            min={0}
            max={1}
            value={local.pitch.silenceThreshold}
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
            value={local.pitch.octaveCost}
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
            value={local.pitch.octaveJumpCost}
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
            value={local.pitch.voicedUnvoicedCost}
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
            value={local.pitch.maxCandidates}
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
            value={local.formant.maxFrequency}
            onChange={(e) => updateFormant({ maxFrequency: Number(e.target.value) })}
          />
        </label>
        <SliderField
          label="LPC order"
          value={local.formant.lpcOrder}
          min={6}
          max={24}
          step={1}
          onChange={(v) => updateFormant({ lpcOrder: v })}
        />
        <label className="settings-field">
          <span>Number of formants</span>
          <input
            type="number"
            min={1}
            max={5}
            value={local.formant.numberOfFormants}
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
            value={local.formant.smoothingWindowMs}
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
            value={local.formant.transitionCostWeight}
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
            value={local.formant.medianFilterSize}
            onChange={(e) => updateFormant({ medianFilterSize: Number(e.target.value) })}
          />
        </label>
      </Section>
    </div>
  );
}
