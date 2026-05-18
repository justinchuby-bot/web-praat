import type { VoiceQualityMetrics } from '../types';

interface VoiceQualityPanelProps {
  metrics: VoiceQualityMetrics;
}

function formatNumber(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.000';
}

export function VoiceQualityPanel({ metrics }: VoiceQualityPanelProps) {
  return (
    <section className="panel">
      <h3>Voice Quality</h3>
      <div className="stat-grid">
        <span>Pulses</span>
        <strong>{metrics.pulses.length}</strong>
        <span>Jitter local</span>
        <strong>{formatNumber(metrics.jitterLocalPercent)}%</strong>
        <span>Jitter abs</span>
        <strong>{formatNumber(metrics.jitterAbsolute, 5)} s</strong>
        <span>RAP</span>
        <strong>{formatNumber(metrics.rap)}</strong>
        <span>PPQ5</span>
        <strong>{formatNumber(metrics.ppq5)}</strong>
        <span>Shimmer local</span>
        <strong>{formatNumber(metrics.shimmerLocalPercent)}%</strong>
        <span>Shimmer dB</span>
        <strong>{formatNumber(metrics.shimmerDb)}</strong>
        <span>APQ3</span>
        <strong>{formatNumber(metrics.apq3)}</strong>
        <span>APQ5</span>
        <strong>{formatNumber(metrics.apq5)}</strong>
      </div>
    </section>
  );
}
