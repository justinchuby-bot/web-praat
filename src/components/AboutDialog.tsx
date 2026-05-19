import { useEffect, useState } from 'react';

export function AboutDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('open-about-dialog', handler);
    return () => document.removeEventListener('open-about-dialog', handler);
  }, []);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
        <h2 style={{ marginBottom: '12px' }}>Web-Praat</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
          A modern, web-based speech analysis tool inspired by Praat.
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
          All DSP implemented in TypeScript — no external libraries.
        </p>
        <ul style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.8' }}>
          <li>Pitch, Formant, Intensity, Harmonicity analysis</li>
          <li>Spectrogram, Cochleagram, LTAS</li>
          <li>TextGrid annotation</li>
          <li>PSOLA manipulation</li>
          <li>Praat Script + JavaScript scripting</li>
          <li>Perception experiments (MFC)</li>
        </ul>
        <p style={{ marginTop: '16px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          GPL-3.0 · github.com/justinchuby/web-praat
        </p>
      </div>
    </div>
  );
}
