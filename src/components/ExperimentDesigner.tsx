import { useState, useCallback } from 'react';
import type { ExperimentConfig } from '../audio/experiment';

interface ExperimentDesignerProps {
  onStart: (config: ExperimentConfig, audioMap: Record<string, string>) => void;
}

export function ExperimentDesigner({ onStart }: ExperimentDesignerProps) {
  const [options, setOptions] = useState('ba, pa');
  const [repetitions, setRepetitions] = useState(3);
  const [randomize, setRandomize] = useState(true);
  const [isi, setIsi] = useState(500);
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }, []);

  const handleStart = useCallback(() => {
    if (files.length === 0) return;

    const stimuli = files.map((f) => f.name);
    const audioMap: Record<string, string> = {};
    for (const f of files) {
      audioMap[f.name] = URL.createObjectURL(f);
    }

    const config: ExperimentConfig = {
      options: options.split(',').map((s) => s.trim()).filter(Boolean),
      stimuli,
      repetitions,
      randomize,
      isi,
    };

    onStart(config, audioMap);
  }, [files, options, repetitions, randomize, isi, onStart]);

  return (
    <div className="flex flex-col gap-4 p-6 max-w-lg">
      <h2 className="text-xl font-bold">Experiment Designer (MFC)</h2>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Audio Stimuli</span>
        <input
          type="file"
          multiple
          accept="audio/*"
          onChange={handleFileChange}
          className="text-sm"
        />
        {files.length > 0 && (
          <span className="text-xs text-gray-500">{files.length} file(s) selected</span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Response Options (comma-separated)</span>
        <input
          type="text"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
          placeholder="ba, pa"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Repetitions per stimulus</span>
        <input
          type="number"
          min={1}
          value={repetitions}
          onChange={(e) => setRepetitions(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm w-24"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">ISI (ms)</span>
        <input
          type="number"
          min={0}
          step={100}
          value={isi}
          onChange={(e) => setIsi(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm w-24"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={randomize}
          onChange={(e) => setRandomize(e.target.checked)}
        />
        <span className="text-sm">Randomize trial order</span>
      </label>

      <button
        onClick={handleStart}
        disabled={files.length === 0}
        className="mt-4 px-4 py-2 bg-green-600 text-white rounded disabled:opacity-40 hover:bg-green-700 transition"
      >
        Start Experiment
      </button>
    </div>
  );
}
