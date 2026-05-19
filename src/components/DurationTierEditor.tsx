import React, { useState, useCallback } from 'react';
import TierEditorBase, { TierPoint, TierTrack } from './TierEditorBase';

interface DurationTierEditorProps {
  duration: number;
  initialPoints?: TierPoint[];
  onApply?: (points: TierPoint[]) => void;
}

/**
 * DurationTierEditor — edit duration ratio curve.
 * Value = 1.0 means no change; < 1 = faster, > 1 = slower.
 */
export default function DurationTierEditor({ duration, initialPoints, onApply }: DurationTierEditorProps) {
  const [points, setPoints] = useState<TierPoint[]>(
    initialPoints || [
      { time: 0, value: 1.0 },
      { time: duration, value: 1.0 },
    ]
  );

  const tracks: TierTrack[] = [{ points, color: '#a78bfa', label: 'Duration Ratio' }];

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
    <div data-testid="duration-tier-editor">
      <TierEditorBase
        duration={duration}
        tracks={tracks}
        minValue={0}
        maxValue={3}
        onPointMoved={handleMoved}
        onPointAdded={handleAdded}
        onPointDeleted={handleDeleted}
        yLabel="Ratio"
        title="Duration Tier"
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
