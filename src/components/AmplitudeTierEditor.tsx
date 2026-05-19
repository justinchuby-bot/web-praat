import React, { useState, useCallback } from 'react';
import TierEditorBase, { TierPoint, TierTrack } from './TierEditorBase';

interface AmplitudeTierEditorProps {
  duration: number;
  initialPoints?: TierPoint[];
  onApply?: (points: TierPoint[]) => void;
}

/**
 * AmplitudeTierEditor — edit amplitude envelope.
 * Value range: 0 (silence) to 1 (full amplitude).
 */
export default function AmplitudeTierEditor({ duration, initialPoints, onApply }: AmplitudeTierEditorProps) {
  const [points, setPoints] = useState<TierPoint[]>(
    initialPoints || [
      { time: 0, value: 1.0 },
      { time: duration, value: 1.0 },
    ]
  );

  const tracks: TierTrack[] = [{ points, color: '#34d399', label: 'Amplitude' }];

  const handleMoved = useCallback((_ti: number, pi: number, p: TierPoint) => {
    setPoints(prev => prev.map((pt, i) => (i === pi ? p : pt)));
  }, []);

  const handleAdded = useCallback((_ti: number, p: TierPoint) => {
    setPoints(prev => [...prev, p].sort((a, b) => a.time - b.time));
  }, []);

  const handleDeleted = useCallback((_ti: number, pi: number) => {
    setPoints(prev => prev.filter((_, i) => i !== pi));
  }, []);

  return (
    <div data-testid="amplitude-tier-editor">
      <TierEditorBase
        duration={duration}
        tracks={tracks}
        minValue={0}
        maxValue={1}
        onPointMoved={handleMoved}
        onPointAdded={handleAdded}
        onPointDeleted={handleDeleted}
        yLabel="Amplitude"
        title="Amplitude Tier"
      />
      {onApply && (
        <button
          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
          onClick={() => onApply(points)}
        >
          Apply to Audio
        </button>
      )}
    </div>
  );
}
