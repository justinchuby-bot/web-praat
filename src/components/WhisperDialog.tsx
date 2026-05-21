import { useState } from 'react';
import type { WhisperModel } from '../audio/whisperTranscribe';

interface WhisperDialogProps {
  onStart: (model: WhisperModel, language: string | null) => void;
  onClose: () => void;
}

const MODELS: { id: WhisperModel; name: string; size: string; desc: string }[] = [
  { id: 'onnx-community/whisper-tiny_timestamped', name: 'Tiny', size: '~40 MB', desc: 'Fastest, multilingual' },
  { id: 'onnx-community/whisper-base_timestamped', name: 'Base', size: '~80 MB', desc: 'Balanced, multilingual' },
  { id: 'onnx-community/whisper-small.en_timestamped', name: 'Small', size: '~150 MB', desc: 'Better accuracy, English' },
  { id: 'onnx-community/whisper-medium.en_timestamped', name: 'Medium', size: '~400 MB', desc: 'Best accuracy, English' },
  { id: 'onnx-community/ipa-whisper-base-ONNX', name: 'IPA (Whisper)', size: '~80 MB', desc: 'IPA transcription (no timestamps)' },
  { id: 'justinchuby/wav2vec2-lv-60-espeak-cv-ft-ONNX', name: 'IPA + Timestamps', size: '~360 MB', desc: 'Phone-level IPA (experimental) ⚠️' },
];

const SAVED_KEY = 'web-praat-whisper-settings';

function loadSaved(): { model: WhisperModel; language: string } {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { model: 'onnx-community/whisper-base_timestamped', language: '' };
}

function save(model: WhisperModel, language: string) {
  localStorage.setItem(SAVED_KEY, JSON.stringify({ model, language }));
}

export function WhisperDialog({ onStart, onClose }: WhisperDialogProps) {
  const saved = loadSaved();
  const [model, setModel] = useState<WhisperModel>(saved.model);
  const [language, setLanguage] = useState(saved.language);

  const handleStart = () => {
    save(model, language);
    onStart(model, language || null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '90vw' }}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>🎤 Transcribe with Whisper</h2>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-dim)' }}>Model</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  border: model === m.id ? '2px solid var(--accent, #89b4fa)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  background: model === m.id ? 'rgba(137,180,250,0.1)' : 'var(--bg-base)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{m.size}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
            Language
          </label>
          <input
            type="text"
            value={language}
            onChange={e => setLanguage(e.target.value)}
            placeholder="Auto-detect (or: en, zh, ja, fr, de...)"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--bg-base)',
              color: 'var(--text)',
              fontSize: '13px',
            }}
          />
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Leave empty for auto-detection. Supports 99 languages.
          </div>
        </div>

        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '10px',
            border: 'none',
            borderRadius: '8px',
            background: 'var(--accent, #89b4fa)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ▶ Start Transcription
        </button>

        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px', textAlign: 'center' }}>
          Model is downloaded once and cached in the browser. Runs locally — audio never leaves your device.
        </div>
      </div>
    </div>
  );
}
