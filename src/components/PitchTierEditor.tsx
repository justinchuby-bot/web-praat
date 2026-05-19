import React, { useState, useEffect, useCallback } from 'react';
import TierEditorBase, { TierPoint, TierTrack } from './TierEditorBase';
import { detectPitchMarks } from '../audio/psola';

interface PitchTierEditorProps {
  samples: Float32Array;
  sampleRate: number;
  onApply?: (pitchTier: TierPoint[]) => void;
}

/**
 * PitchTierEditor — edit pitch (F0) curve.
 * Points represent time→frequency pairs.
 */
export default function PitchTierEditor({ samples, sampleRate, onApply }: PitchTierEditorProps) {
  const [points, setPoints] = useState<TierPoint[]>([]);
  const duration = samples.length / sampleRate;
  const minF0 = 50;
  const maxF0 = 500;

  useEffect(() => {
    if (samples.length === 0) return;
    const marks = detectPitchMarks(samples, sampleRate);
    const pts: TierPoint[] = [];
    for (let i = 0; i < marks.length - 1; i++) {
      const period = (marks[i + 1] - marks[i]) / sampleRate;
      const freq = 1 / period;
      if (freq >= minF0 && freq <= maxF0) {
        pts.push({ time: marks[i] / sampleRate, value: freq });
      }
    }
    const step = Math.max(1, Math.floor(pts.length / 20));
    setPoints(pts.filter((_, i) => i % step === 0));
  }, [samples, sampleRate]);

  const tracks: TierTrack[] = [{ points, color: '#00d4ff', label: 'Pitch' }];

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
    <div data-testid="pitch-tier-editor">
      <TierEditorBase
        duration={duration}
        tracks={tracks}
        minValue={minF0}
        maxValue={maxF0}
        onPointMoved={handleMoved}
        onPointAdded={handleAdded}
        onPointDeleted={handleDeleted}
        yLabel="Frequency (Hz)"
        title="Pitch Tier"
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
