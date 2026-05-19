import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  type SpeechSynthesizerSettings,
  DEFAULT_SETTINGS,
  getAvailableVoices,
  isSpeechSynthesisSupported,
  speak,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  isSpeaking,
  type SynthesisResult,
} from '../audio/speechSynthesizer';

interface SpeechSynthesizerPanelProps {
  onClose?: () => void;
}

const SpeechSynthesizerPanel: React.FC<SpeechSynthesizerPanelProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<SpeechSynthesizerSettings>(DEFAULT_SETTINGS);
  const [text, setText] = useState('Hello, this is a speech synthesis test.');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = isSpeechSynthesisSupported();
  const pollRef = useRef<number | null>(null);

  // Load voices (may be async in some browsers)
  useEffect(() => {
    const loadVoices = () => {
      const v = getAvailableVoices();
      if (v.length > 0) {
        setVoices(v);
        // Set default voice
        if (!settings.voiceName) {
          const defaultVoice = v.find((voice) => voice.default) || v[0];
          setSettings((s) => ({
            ...s,
            voiceName: defaultVoice.name,
            language: defaultVoice.lang,
          }));
        }
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll speaking state
  useEffect(() => {
    if (speaking) {
      pollRef.current = window.setInterval(() => {
        if (!isSpeaking()) {
          setSpeaking(false);
          setPaused(false);
        }
      }, 200);
    }
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [speaking]);

  const handleSpeak = useCallback(async () => {
    setError(null);
    setResult(null);
    setSpeaking(true);
    setPaused(false);
    try {
      const res = await speak(text, settings);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeaking(false);
      setPaused(false);
    }
  }, [text, settings]);

  const handleStop = useCallback(() => {
    stopSpeaking();
    setSpeaking(false);
    setPaused(false);
  }, []);

  const handlePause = useCallback(() => {
    if (paused) {
      resumeSpeaking();
      setPaused(false);
    } else {
      pauseSpeaking();
      setPaused(true);
    }
  }, [paused]);

  const handleVoiceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const voice = voices.find((v) => v.name === e.target.value);
      if (voice) {
        setSettings((s) => ({
          ...s,
          voiceName: voice.name,
          language: voice.lang,
        }));
      }
    },
    [voices],
  );

  // Group voices by language
  const voicesByLang = React.useMemo(() => {
    const map = new Map<string, SpeechSynthesisVoice[]>();
    for (const v of voices) {
      const lang = v.lang.split('-')[0];
      if (!map.has(lang)) map.set(lang, []);
      map.get(lang)!.push(v);
    }
    return map;
  }, [voices]);

  if (!supported) {
    return (
      <div className="p-4 text-zinc-300">
        <h2 className="text-lg font-semibold mb-2">SpeechSynthesizer</h2>
        <p className="text-red-400">
          Web Speech API is not supported in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 text-zinc-300 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">SpeechSynthesizer</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xl"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Text input */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 resize-y focus:outline-none focus:border-blue-500"
          placeholder="Enter text to synthesize..."
        />
      </div>

      {/* Voice selection */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Voice</label>
        <select
          value={settings.voiceName}
          onChange={handleVoiceChange}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
        >
          {[...voicesByLang.entries()].map(([lang, langVoices]) => (
            <optgroup key={lang} label={lang.toUpperCase()}>
              {langVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang}){v.default ? ' ★' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Controls: rate, pitch, volume */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Rate: {settings.rate.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={settings.rate}
            onChange={(e) =>
              setSettings((s) => ({ ...s, rate: parseFloat(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Pitch: {settings.pitch.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.pitch}
            onChange={(e) =>
              setSettings((s) => ({ ...s, pitch: parseFloat(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Volume: {settings.volume.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(e) =>
              setSettings((s) => ({ ...s, volume: parseFloat(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSpeak}
          disabled={speaking || !text.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
        >
          {speaking ? 'Speaking…' : 'Speak'}
        </button>
        {speaking && (
          <>
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-medium transition-colors"
            >
              Stop
            </button>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded p-2">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="text-sm bg-zinc-800 border border-zinc-700 rounded p-3 space-y-1">
          <p>
            <span className="text-zinc-400">Duration:</span>{' '}
            {result.duration.toFixed(2)}s
          </p>
          {result.wordBoundaries.length > 0 && (
            <details>
              <summary className="text-zinc-400 cursor-pointer hover:text-zinc-200">
                Word boundaries ({result.wordBoundaries.length})
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto text-xs font-mono text-zinc-400">
                {result.wordBoundaries.map((wb, i) => (
                  <div key={i}>
                    {wb.time.toFixed(3)}s — &quot;{wb.word}&quot;
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default SpeechSynthesizerPanel;
