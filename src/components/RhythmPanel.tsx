import type { RhythmMetrics } from '../types';

interface RhythmPanelProps {
  metrics: RhythmMetrics;
}

function fmt(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export function RhythmPanel({ metrics }: RhythmPanelProps) {
  return (
    <section className="panel">
      <h3>Rhythm</h3>
      <div className="panel-subtitle">Interval timing metrics</div>

      <div className="stat-section">
        <div className="stat-section-title">Duration</div>
        <div className="stat-grid">
          <span>Intervals</span>
          <strong>{metrics.count}</strong>
          <span>Mean</span>
          <strong>{fmt(metrics.mean)} s</strong>
          <span>Stdev</span>
          <strong>{fmt(metrics.stdev)} s</strong>
          <span>Range</span>
          <strong>{fmt(metrics.min)}–{fmt(metrics.max)} s</strong>
        </div>
      </div>

      <div className="stat-section">
        <div className="stat-section-title">Variability indices</div>
        <div className="stat-grid">
          <span>nPVI</span>
          <strong>{fmt(metrics.nPVI)}</strong>
          <span>rPVI</span>
          <strong>{fmt(metrics.rPVI)}</strong>
        </div>
      </div>
    </section>
  );
}
