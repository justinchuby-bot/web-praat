import type { VoiceQualityMetrics } from '../types';

interface VoiceQualityPanelProps {
  metrics: VoiceQualityMetrics;
}

function formatNumber(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function StatusDot({ normal }: { normal: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: normal ? 'var(--green)' : 'var(--orange)',
        marginRight: 4,
      }}
    />
  );
}

export function VoiceQualityPanel({ metrics }: VoiceQualityPanelProps) {
  const jitterNormal = metrics.jitterLocalPercent < 1.04;
  const shimmerNormal = metrics.shimmerLocalPercent < 3.81;

  return (
    <section className="panel">
      <h3>Voice Quality</h3>
      <div className="panel-subtitle">Perturbation analysis</div>

      <div className="stat-section">
        <div className="stat-section-title">Jitter (period)</div>
        <div className="stat-grid">
          <span><StatusDot normal={jitterNormal} />Local</span>
          <strong>{formatNumber(metrics.jitterLocalPercent)}%</strong>
          <span>Absolute</span>
          <strong>{formatNumber(metrics.jitterAbsolute, 5)} s</strong>
          <span>RAP</span>
          <strong>{formatNumber(metrics.rap)}</strong>
          <span>PPQ5</span>
          <strong>{formatNumber(metrics.ppq5)}</strong>
        </div>
      </div>

      <div className="stat-section">
        <div className="stat-section-title">Shimmer (amplitude)</div>
        <div className="stat-grid">
          <span><StatusDot normal={shimmerNormal} />Local</span>
          <strong>{formatNumber(metrics.shimmerLocalPercent)}%</strong>
          <span>dB</span>
          <strong>{formatNumber(metrics.shimmerDb)} dB</strong>
          <span>APQ3</span>
          <strong>{formatNumber(metrics.apq3)}</strong>
          <span>APQ5</span>
          <strong>{formatNumber(metrics.apq5)}</strong>
        </div>
      </div>

      <div className="stat-section">
        <div className="stat-section-title">Summary</div>
        <div className="stat-grid">
          <span>Pulses detected</span>
          <strong>{metrics.pulses.length}</strong>
        </div>
      </div>
    </section>
  );
}
