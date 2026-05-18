import type { FilterSettings } from '../types';

interface FilterPanelProps {
  settings: FilterSettings;
  onChange: (settings: FilterSettings) => void;
  onApply: () => void;
  onReset: () => void;
}

export function FilterPanel({ settings, onChange, onApply, onReset }: FilterPanelProps) {
  return (
    <section className="panel">
      <h3>Filter</h3>
      <label className="field">
        <span>Type</span>
        <select
          value={settings.type}
          onChange={(event) => onChange({ ...settings, type: event.target.value as FilterSettings['type'] })}
        >
          <option value="none">None</option>
          <option value="lowpass">Low-pass</option>
          <option value="highpass">High-pass</option>
          <option value="bandpass">Band-pass</option>
        </select>
      </label>
      <label className="field">
        <span>Cutoff (Hz)</span>
        <input
          type="number"
          min={20}
          max={20000}
          value={settings.cutoffHz}
          onChange={(event) => onChange({ ...settings, cutoffHz: Number(event.target.value) })}
        />
      </label>
      <div className="panel-actions">
        <button className="btn btn-secondary" onClick={onReset}>
          Reset
        </button>
        <button className="btn btn-primary" onClick={onApply}>
          Apply
        </button>
      </div>
    </section>
  );
}
