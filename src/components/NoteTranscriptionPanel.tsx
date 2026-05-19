import { useState, useMemo } from 'react';
import { transcribePitch, formatTranscription, type TranscriptionOptions, type NoteEvent } from '../audio/noteTranscription';
import type { PitchData } from '../types';

interface NoteTranscriptionPanelProps {
  pitch: PitchData | null;
  onClose: () => void;
}

export default function NoteTranscriptionPanel({ pitch, onClose }: NoteTranscriptionPanelProps) {
  const [referenceA4, setReferenceA4] = useState(440);
  const [minDuration, setMinDuration] = useState(0.05);
  const [minConfidence, setMinConfidence] = useState(0.5);

  const options: TranscriptionOptions = useMemo(() => ({
    referenceA4,
    minDuration,
    minConfidence,
  }), [referenceA4, minDuration, minConfidence]);

  const events: NoteEvent[] = useMemo(() => {
    if (!pitch) return [];
    return transcribePitch(pitch, options);
  }, [pitch, options]);

  const handleExport = () => {
    const text = formatTranscription(events);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'note-transcription.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Note Transcription</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xs">✕</button>
      </div>

      {/* Settings */}
      <div className="flex gap-4 text-xs text-zinc-400">
        <label className="flex items-center gap-1">
          A4 =
          <input
            type="number"
            value={referenceA4}
            onChange={e => setReferenceA4(Number(e.target.value))}
            className="w-14 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200"
            min={400}
            max={480}
            step={1}
          />
          Hz
        </label>
        <label className="flex items-center gap-1">
          Min dur:
          <input
            type="number"
            value={minDuration}
            onChange={e => setMinDuration(Number(e.target.value))}
            className="w-14 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200"
            min={0.01}
            max={1}
            step={0.01}
          />
          s
        </label>
        <label className="flex items-center gap-1">
          Min conf:
          <input
            type="number"
            value={minConfidence}
            onChange={e => setMinConfidence(Number(e.target.value))}
            className="w-14 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200"
            min={0}
            max={1}
            step={0.1}
          />
        </label>
      </div>

      {/* Results */}
      {!pitch ? (
        <p className="text-xs text-zinc-500">No pitch data available. Analyze audio first.</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-zinc-500">No notes detected with current settings.</p>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs text-zinc-300">
            <thead className="text-zinc-500 border-b border-zinc-700">
              <tr>
                <th className="text-left py-1">Time</th>
                <th className="text-left py-1">Note</th>
                <th className="text-right py-1">Cents</th>
                <th className="text-right py-1">Hz</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="py-0.5">{e.startTime.toFixed(2)}–{e.endTime.toFixed(2)}s</td>
                  <td className="py-0.5 font-mono font-semibold">{e.note.name}</td>
                  <td className="py-0.5 text-right">
                    <span className={e.note.cents > 10 ? 'text-yellow-400' : e.note.cents < -10 ? 'text-blue-400' : 'text-green-400'}>
                      {e.note.cents >= 0 ? '+' : ''}{e.note.cents}¢
                    </span>
                  </td>
                  <td className="py-0.5 text-right">{e.note.frequency.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={events.length === 0}
          className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded text-zinc-200"
        >
          Export TXT
        </button>
        <span className="text-xs text-zinc-500 self-center">
          {events.length} note{events.length !== 1 ? 's' : ''} detected
        </span>
      </div>
    </div>
  );
}
