import React, { useState, useCallback } from 'react';
import TierEditorBase, { TierPoint, TierTrack } from './TierEditorBase';

interface FormantGridEditorProps {
  /** Duration of audio in seconds */
  duration: number;
  /** Initial formant tracks [F1, F2, F3] — each an array of time→frequency points */
  initialFormants?: [TierPoint[], TierPoint[], TierPoint[]];
  onApply?: (formants: [TierPoint[], TierPoint[], TierPoint[]]) => void;
}

const FORMANT_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77'];
const FORMANT_LABELS = ['F1', 'F2', 'F3'];

/**
 * FormantGridEditor — edit F1/F2/F3 formant trajectories.
 */
export default function FormantGridEditor({ duration, initialFormants, onApply }: FormantGridEditorProps) {
  const defaultFormants: [TierPoint[], TierPoint[], TierPoint[]] = initialFormants || [
    [{ time: 0, value: 500 }, { time: duration, value: 500 }],
    [{ time: 0, value: 1500 }, { time: duration, value: 1500 }],
    [{ time: 0, value: 2500 }, { time: duration, value: 2500 }],
  ];
  const [formants, setFormants] = useState<[TierPoint[], TierPoint[], TierPoint[]]>(defaultFormants);

  const tracks: TierTrack[] = formants.map((pts, i) => ({
    points: pts,
    color: FORMANT_COLORS[i],
    label: FORMANT_LABELS[i],
  }));

  const handleMoved = useCallback((ti: number, pi: number, p: TierPoint) => {
    setFormants(prev => {
      const next = [...prev] as [TierPoint[], TierPoint[], TierPoint[]];
      next[ti] = prev[ti].map((pt, i) => (i === pi ? p : pt));
      return next;
    });
  }, []);

  const handleAdded = useCallback((ti: number, p: TierPoint) => {
    setFormants(prev => {
      const next = [...prev] as [TierPoint[], TierPoint[], TierPoint[]];
      next[ti] = [...prev[ti], p].sort((a, b) => a.time - b.time);
      return next;
    });
  }, []);

  const handleDeleted = useCallback((ti: number, pi: number) => {
    setFormants(prev => {
      const next = [...prev] as [TierPoint[], TierPoint[], TierPoint[]];
      next[ti] = prev[ti].filter((_, i) => i !== pi);
      return next;
    });
  }, []);

  return (
    <div data-testid="formant-grid-editor">
      <TierEditorBase
        duration={duration}
        tracks={tracks}
        minValue={0}
        maxValue={4000}
        onPointMoved={handleMoved}
        onPointAdded={handleAdded}
        onPointDeleted={handleDeleted}
        yLabel="Frequency (Hz)"
        title="Formant Grid (F1/F2/F3)"
      />
      {onApply && (
        <button
          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
          onClick={() => onApply(formants)}
        >
          Apply to Audio
        </button>
      )}
    </div>
  );
}
