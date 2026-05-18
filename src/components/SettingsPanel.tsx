import type { AnalysisSettings } from '../types';

interface SettingsPanelProps {
  settings: AnalysisSettings;
  onChange: (settings: AnalysisSettings) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <section className="panel">
      <h3>Settings</h3>
      <div className="panel-subtitle">Spectrogram</div>
      <label className="field">
        <span>FFT size</span>
        <select
          value={settings.spectrogram.fftSize}
          onChange={(event) =>
            onChange({
              ...settings,
              spectrogram: {
                ...settings.spectrogram,
                fftSize: Number(event.target.value) as AnalysisSettings['spectrogram']['fftSize'],
              },
            })
          }
        >
          {[256, 512, 1024, 2048].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Hop size</span>
        <input
          type="number"
          value={settings.spectrogram.hopSize}
          onChange={(event) =>
            onChange({
              ...settings,
              spectrogram: { ...settings.spectrogram, hopSize: Number(event.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>Dynamic range</span>
        <input
          type="number"
          value={settings.spectrogram.dynamicRangeDb}
          onChange={(event) =>
            onChange({
              ...settings,
              spectrogram: { ...settings.spectrogram, dynamicRangeDb: Number(event.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>Colormap</span>
        <select
          value={settings.spectrogram.colormap}
          onChange={(event) =>
            onChange({
              ...settings,
              spectrogram: {
                ...settings.spectrogram,
                colormap: event.target.value as AnalysisSettings['spectrogram']['colormap'],
              },
            })
          }
        >
          <option value="jet">Jet</option>
          <option value="grayscale">Grayscale</option>
        </select>
      </label>

      <div className="panel-subtitle">Pitch</div>
      <label className="field">
        <span>Min Hz</span>
        <input
          type="number"
          value={settings.pitch.minHz}
          onChange={(event) =>
            onChange({ ...settings, pitch: { ...settings.pitch, minHz: Number(event.target.value) } })
          }
        />
      </label>
      <label className="field">
        <span>Max Hz</span>
        <input
          type="number"
          value={settings.pitch.maxHz}
          onChange={(event) =>
            onChange({ ...settings, pitch: { ...settings.pitch, maxHz: Number(event.target.value) } })
          }
        />
      </label>
      <label className="field">
        <span>Voicing threshold</span>
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={settings.pitch.voicingThreshold}
          onChange={(event) =>
            onChange({
              ...settings,
              pitch: { ...settings.pitch, voicingThreshold: Number(event.target.value) },
            })
          }
        />
      </label>

      <div className="panel-subtitle">Formants</div>
      <label className="field">
        <span>Max frequency</span>
        <input
          type="number"
          value={settings.formant.maxFrequency}
          onChange={(event) =>
            onChange({
              ...settings,
              formant: { ...settings.formant, maxFrequency: Number(event.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>LPC order</span>
        <input
          type="number"
          value={settings.formant.lpcOrder}
          onChange={(event) =>
            onChange({
              ...settings,
              formant: { ...settings.formant, lpcOrder: Number(event.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>Formants</span>
        <input
          type="number"
          min={1}
          max={5}
          value={settings.formant.numberOfFormants}
          onChange={(event) =>
            onChange({
              ...settings,
              formant: { ...settings.formant, numberOfFormants: Number(event.target.value) },
            })
          }
        />
      </label>
    </section>
  );
}
