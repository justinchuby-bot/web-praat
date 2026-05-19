import { useState, useRef, useCallback, useEffect } from 'react';
import type { ExperimentConfig, TrialResult, ExperimentResults } from '../audio/experiment';
import { generateTrialOrder, exportResultsToCSV } from '../audio/experiment';

interface ExperimentMFCProps {
  config: ExperimentConfig;
  /** Map from stimulus name to audio URL/blob URL */
  audioMap: Record<string, string>;
  onComplete: (results: ExperimentResults) => void;
}

export function ExperimentMFC({ config, audioMap, onComplete }: ExperimentMFCProps) {
  const [trialOrder] = useState(() => generateTrialOrder(config));
  const [currentTrial, setCurrentTrial] = useState(0);
  const [waiting, setWaiting] = useState(true); // waiting for audio to finish / ISI
  const [results] = useState<TrialResult[]>([]);
  const [startTime] = useState(Date.now());
  const stimulusOnset = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalTrials = trialOrder.length;
  const done = currentTrial >= totalTrials;

  // Play current stimulus
  useEffect(() => {
    if (done) return;
    const stimulus = trialOrder[currentTrial];
    const url = audioMap[stimulus];
    if (!url) return;

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      stimulusOnset.current = Date.now();
      setWaiting(false);
    };
    audio.play().catch(() => {
      // If autoplay blocked, allow response immediately
      stimulusOnset.current = Date.now();
      setWaiting(false);
    });

    return () => {
      audio.pause();
    };
  }, [currentTrial, done, trialOrder, audioMap]);

  const handleResponse = useCallback(
    (response: string) => {
      if (waiting || done) return;
      const rt = Date.now() - stimulusOnset.current;
      results.push({
        trialIndex: currentTrial,
        stimulus: trialOrder[currentTrial],
        response,
        reactionTime: rt,
      });

      setWaiting(true);

      if (currentTrial + 1 >= totalTrials) {
        const experimentResults: ExperimentResults = {
          config,
          trials: results,
          startTime,
          endTime: Date.now(),
        };
        onComplete(experimentResults);
        setCurrentTrial(currentTrial + 1);
      } else {
        // ISI then next trial
        setTimeout(() => {
          setCurrentTrial(currentTrial + 1);
        }, config.isi);
      }
    },
    [waiting, done, currentTrial, totalTrials, config, results, trialOrder, startTime, onComplete]
  );

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <h2 className="text-xl font-bold">Experiment Complete</h2>
        <p>Total trials: {results.length}</p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => {
            const csv = exportResultsToCSV({
              config,
              trials: results,
              startTime,
              endTime: Date.now(),
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'experiment_results.csv';
            a.click();
          }}
        >
          Download CSV
        </button>
      </div>
    );
  }

  const progress = ((currentTrial) / totalTrials) * 100;

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Progress bar */}
      <div className="w-full max-w-md bg-gray-200 rounded-full h-3">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500">
        Trial {currentTrial + 1} / {totalTrials}
      </p>

      {/* Response buttons */}
      <div className="flex gap-4 mt-8">
        {config.options.map((opt) => (
          <button
            key={opt}
            disabled={waiting}
            onClick={() => handleResponse(opt)}
            className="px-6 py-3 text-lg font-semibold rounded bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition"
          >
            {opt}
          </button>
        ))}
      </div>

      {waiting && <p className="text-gray-400 text-sm">Playing stimulus...</p>}
    </div>
  );
}
