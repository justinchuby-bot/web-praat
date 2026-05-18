import type { RhythmMetrics } from '../types';

interface RhythmPanelProps {
  metrics: RhythmMetrics;
}

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000';
}

export function RhythmPanel({ metrics }: RhythmPanelProps) {
  return (
    <section className="panel">
      <h3>Rhythm</h3>
      <div className="stat-grid">
        <span>Intervals</span>
        <strong>{metrics.count}</strong>
        <span>Mean</span>
        <strong>{formatMetric(metrics.mean)} s</strong>
        <span>Stdev</span>
        <strong>{formatMetric(metrics.stdev)} s</strong>
        <span>Min</span>
        <strong>{formatMetric(metrics.min)} s</strong>
        <span>Max</span>
        <strong>{formatMetric(metrics.max)} s</strong>
        <span>nPVI</span>
        <strong>{formatMetric(metrics.nPVI)}</strong>
        <span>rPVI</span>
        <strong>{formatMetric(metrics.rPVI)}</strong>
      </div>
    </section>
  );
}
