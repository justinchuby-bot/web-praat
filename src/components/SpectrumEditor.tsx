import { useState, useCallback, useMemo, useRef } from 'react';
import type { SpectrumSliceData, FilterType } from '../types';
import {
  presetToGainCurve,
  applyGainCurveFilter,
} from '../audio/filters';

export interface SpectrumEditorProps {
  /** Current spectrum slice (from selected time point) */
  slice: SpectrumSliceData | null;
  /** Audio samples for the current selection/frame */
  samples: Float32Array | null;
  /** Sample rate */
  sampleRate: number;
  /** Callback when filter is applied — returns new filtered samples */
  onApplyFilter?: (filteredSamples: Float32Array) => void;
}

interface FilterConfig {
  type: FilterType;
  cutoffHz: number;
  q: number;
  order: number;
  /** Custom drawn gain curve (linear, per bin). null = use preset. */
  customCurve: Float64Array | null;
}

const DEFAULT_CONFIG: FilterConfig = {
  type: 'lowpass',
  cutoffHz: 4000,
  q: Math.SQRT1_2,
  order: 4,
  customCurve: null,
};

function nextPowerOfTwo(n: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, n)));
}

/**
 * Compute the filtered spectrum preview (magnitude) by applying gain curve.
 */
function computeFilteredSpectrum(
  originalMagnitudes: Float64Array,
  gainCurve: Float64Array
): Float64Array {
  const result = new Float64Array(originalMagnitudes.length);
  for (let i = 0; i < result.length; i++) {
    const g = i < gainCurve.length ? gainCurve[i] : 1;
    result[i] = originalMagnitudes[i] * g;
  }
  return result;
}

export function SpectrumEditor({ slice, samples, sampleRate, onApplyFilter }: SpectrumEditorProps) {
  const [config, setConfig] = useState<FilterConfig>(DEFAULT_CONFIG);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const numBins = slice ? slice.fftMagnitudes.length : 512;

  // Compute gain curve from config (preset or custom)
  const gainCurve = useMemo(() => {
    if (config.customCurve) return config.customCurve;
    return presetToGainCurve(config.type, numBins, sampleRate, config.cutoffHz, config.q, config.order);
  }, [config, numBins, sampleRate]);

  // Real-time filtered spectrum preview
  const filteredSpectrum = useMemo(() => {
    if (!slice) return null;
    return computeFilteredSpectrum(slice.fftMagnitudes, gainCurve);
  }, [slice, gainCurve]);

  // Draw handler: convert mouse position to bin index & gain value
  const handleDraw = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    const bin = Math.round(x * (numBins - 1));
    const gain = Math.max(0, Math.min(4, y * 2)); // gain 0..2 mapped to bottom..top

    setConfig(prev => {
      const curve = prev.customCurve
        ? Float64Array.from(prev.customCurve)
        : new Float64Array(numBins).fill(1);
      // Paint a few bins around the cursor for smoother drawing
      const radius = Math.max(1, Math.round(numBins * 0.01));
      for (let i = Math.max(0, bin - radius); i <= Math.min(numBins - 1, bin + radius); i++) {
        curve[i] = gain;
      }
      return { ...prev, customCurve: curve };
    });
  }, [isDrawing, numBins]);

  const handleApply = useCallback(() => {
    if (!samples || !onApplyFilter) return;
    const filtered = applyGainCurveFilter(samples, gainCurve);
    onApplyFilter(filtered);
  }, [samples, gainCurve, onApplyFilter]);

  const handleReset = useCallback(() => {
    setConfig(prev => ({ ...prev, customCurve: null }));
  }, []);

  if (!slice) {
    return (
      <section className="panel">
        <h3>Spectrum Editor</h3>
        <p className="panel-empty">Select a time point to edit the spectrum.</p>
      </section>
    );
  }

  const maxMag = Math.max(...Array.from(slice.fftMagnitudes), 1e-6);

  // Original spectrum polyline
  const originalPoints = Array.from(slice.fftMagnitudes).map((m, i) => {
    const x = (i / Math.max(numBins - 1, 1)) * 100;
    const y = 100 - (m / maxMag) * 100;
    return `${x},${y}`;
  }).join(' ');

  // Filtered spectrum preview polyline
  const filteredPoints = filteredSpectrum
    ? Array.from(filteredSpectrum).map((m, i) => {
        const x = (i / Math.max(numBins - 1, 1)) * 100;
        const y = 100 - (m / maxMag) * 100;
        return `${x},${y}`;
      }).join(' ')
    : '';

  // Gain curve polyline (show as overlay)
  const gainPoints = Array.from(gainCurve).map((g, i) => {
    const x = (i / Math.max(gainCurve.length - 1, 1)) * 100;
    const y = 100 - (g / 2) * 100; // gain 0→bottom, 2→top
    return `${x},${y}`;
  }).join(' ');

  return (
    <section className="panel spectrum-editor">
      <h3>Spectrum Editor</h3>
      <p className="panel-caption">Time {slice.time.toFixed(3)} s</p>

      {/* Plot */}
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="spectrum-editor-plot"
        preserveAspectRatio="none"
        onMouseDown={() => drawMode && setIsDrawing(true)}
        onMouseUp={() => setIsDrawing(false)}
        onMouseLeave={() => setIsDrawing(false)}
        onMouseMove={handleDraw}
      >
        {/* Original spectrum */}
        <polyline fill="none" stroke="#89b4fa" strokeWidth="0.8" opacity="0.5" points={originalPoints} />
        {/* Filtered preview */}
        {filteredPoints && (
          <polyline fill="none" stroke="#a6e3a1" strokeWidth="1.2" points={filteredPoints} />
        )}
        {/* Gain curve */}
        <polyline fill="none" stroke="#f9e2af" strokeWidth="0.8" strokeDasharray="2,1" points={gainPoints} />
        {/* Unity line */}
        <line x1="0" y1="50" x2="100" y2="50" stroke="#585b70" strokeWidth="0.3" strokeDasharray="1,1" />
      </svg>

      <div className="panel-legend">
        <span className="legend-item legend-blue">Original</span>
        <span className="legend-item legend-green">Filtered</span>
        <span className="legend-item legend-yellow">Gain curve</span>
      </div>

      {/* Controls */}
      <div className="spectrum-editor-controls">
        <label>
          Mode:
          <button
            className={drawMode ? 'active' : ''}
            onClick={() => setDrawMode(!drawMode)}
          >
            {drawMode ? '✏️ Drawing' : '🎛️ Preset'}
          </button>
        </label>

        {!drawMode && (
          <>
            <label>
              Filter:
              <select
                value={config.type}
                onChange={e => setConfig(prev => ({ ...prev, type: e.target.value as FilterType, customCurve: null }))}
              >
                <option value="none">None</option>
                <option value="lowpass">Low Pass</option>
                <option value="highpass">High Pass</option>
                <option value="bandpass">Band Pass</option>
                <option value="notch">Notch</option>
              </select>
            </label>
            <label>
              Cutoff: {config.cutoffHz} Hz
              <input
                type="range"
                min={20}
                max={sampleRate / 2}
                value={config.cutoffHz}
                onChange={e => setConfig(prev => ({ ...prev, cutoffHz: Number(e.target.value), customCurve: null }))}
              />
            </label>
            <label>
              Q: {config.q.toFixed(2)}
              <input
                type="range"
                min={0.1}
                max={20}
                step={0.1}
                value={config.q}
                onChange={e => setConfig(prev => ({ ...prev, q: Number(e.target.value), customCurve: null }))}
              />
            </label>
            <label>
              Order: {config.order}
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={config.order}
                onChange={e => setConfig(prev => ({ ...prev, order: Number(e.target.value), customCurve: null }))}
              />
            </label>
          </>
        )}

        {drawMode && (
          <button onClick={handleReset}>Reset Curve</button>
        )}

        <button
          className="primary"
          onClick={handleApply}
          disabled={!samples || !onApplyFilter}
        >
          Apply Filter
        </button>
      </div>
    </section>
  );
}
