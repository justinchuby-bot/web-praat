/**
 * VoiceReportDialog — Praat-style "Voice report" dialog.
 * Shows a comprehensive voice quality report (pitch, jitter, shimmer, HNR)
 * computed from PointProcess (pulses) + audio.
 */
import type { VoiceQualityMetrics } from '../types';

interface VoiceReportDialogProps {
  open: boolean;
  onClose: () => void;
  metrics: VoiceQualityMetrics | null;
  /** Duration in seconds */
  duration: number;
  /** Mean pitch (Hz) */
  meanPitch: number;
  /** Median pitch (Hz) */
  medianPitch: number;
  /** Number of pulses */
  pulseCount: number;
  /** Mean period (seconds) */
  meanPeriod: number;
  /** HNR mean (dB) */
  hnrMean: number;
}

export function VoiceReportDialog({
  open, onClose, metrics, duration, meanPitch, medianPitch, pulseCount, meanPeriod, hnrMean,
}: VoiceReportDialogProps) {
  if (!open) return null;

  const formatNum = (v: number, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '—';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content voice-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Voice Report</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="voice-report-body">
          <section>
            <h3>Pitch</h3>
            <table className="voice-report-table">
              <tbody>
                <tr><td>Median pitch</td><td>{formatNum(medianPitch, 1)} Hz</td></tr>
                <tr><td>Mean pitch</td><td>{formatNum(meanPitch, 1)} Hz</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3>Pulses</h3>
            <table className="voice-report-table">
              <tbody>
                <tr><td>Number of pulses</td><td>{pulseCount}</td></tr>
                <tr><td>Number of periods</td><td>{Math.max(0, pulseCount - 1)}</td></tr>
                <tr><td>Mean period</td><td>{formatNum(meanPeriod, 6)} s</td></tr>
              </tbody>
            </table>
          </section>

          {metrics && (
            <>
              <section>
                <h3>Jitter</h3>
                <table className="voice-report-table">
                  <tbody>
                    <tr><td>Jitter (local)</td><td>{formatNum(metrics.jitterLocalPercent)}%</td></tr>
                    <tr><td>Jitter (local, absolute)</td><td>{formatNum(metrics.jitterAbsolute, 6)} s</td></tr>
                    <tr><td>Jitter (rap)</td><td>{formatNum(metrics.rap)}</td></tr>
                    <tr><td>Jitter (ppq5)</td><td>{formatNum(metrics.ppq5)}</td></tr>
                  </tbody>
                </table>
              </section>

              <section>
                <h3>Shimmer</h3>
                <table className="voice-report-table">
                  <tbody>
                    <tr><td>Shimmer (local)</td><td>{formatNum(metrics.shimmerLocalPercent)}%</td></tr>
                    <tr><td>Shimmer (local, dB)</td><td>{formatNum(metrics.shimmerDb)} dB</td></tr>
                    <tr><td>Shimmer (apq3)</td><td>{formatNum(metrics.apq3)}</td></tr>
                    <tr><td>Shimmer (apq5)</td><td>{formatNum(metrics.apq5)}</td></tr>
                  </tbody>
                </table>
              </section>
            </>
          )}

          <section>
            <h3>Harmonics-to-Noise Ratio</h3>
            <table className="voice-report-table">
              <tbody>
                <tr><td>Mean HNR</td><td>{formatNum(hnrMean, 1)} dB</td></tr>
              </tbody>
            </table>
          </section>

          <div className="voice-report-footer">
            <span>Duration: {formatNum(duration, 3)} s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
