import { useRef, useEffect, useState, useCallback } from 'react';
import type { PitchData, PitchTierPoint, DurationTierPoint } from '../types';
import { extractPulses, synthesizePsola } from '../utils/psola';

interface ManipulationPanelProps {
  samples: Float32Array;
  sampleRate: number;
  pitchData: PitchData;
  duration: number;
  onApply: (newSamples: Float32Array) => void;
}

export function ManipulationPanel({ samples, sampleRate, pitchData, duration, onApply }: ManipulationPanelProps) {
  const [pitchTier, setPitchTier] = useState<PitchTierPoint[]>([]);
  const [durationTier, setDurationTier] = useState<DurationTierPoint[]>([]);
  const [_dragging, _setDragging] = useState<{ type: 'pitch' | 'duration'; index: number } | null>(null);
  const pitchCanvasRef = useRef<HTMLCanvasElement>(null);
  const durCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize pitch tier from analysis
  const initializePitchTier = useCallback(() => {
    const points: PitchTierPoint[] = [];
    for (let i = 0; i < pitchData.times.length; i += Math.max(1, Math.floor(pitchData.times.length / 20))) {
      const freq = pitchData.frequencies[i];
      if (freq !== null && freq > 0) {
        points.push({ time: pitchData.times[i], frequency: freq });
      }
    }
    setPitchTier(points);
  }, [pitchData]);

  useEffect(() => {
    if (pitchTier.length === 0) initializePitchTier();
  }, [initializePitchTier, pitchTier.length]);

  // Draw pitch tier canvas
  useEffect(() => {
    const canvas = pitchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let f = 100; f <= 500; f += 100) {
      const y = h - ((f - 50) / 500) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${f} Hz`, 2, y - 2);
    }

    // Draw original pitch as background
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < pitchData.times.length; i++) {
      const freq = pitchData.frequencies[i];
      if (freq === null || freq <= 0) { started = false; continue; }
      const x = (pitchData.times[i] / duration) * w;
      const y = h - ((freq - 50) / 500) * h;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw pitch tier points
    ctx.fillStyle = '#4ecdc4';
    for (let i = 0; i < pitchTier.length; i++) {
      const x = (pitchTier[i].time / duration) * w;
      const y = h - ((pitchTier[i].frequency - 50) / 500) * h;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connect pitch tier points
    if (pitchTier.length > 1) {
      ctx.strokeStyle = '#4ecdc4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sorted = [...pitchTier].sort((a, b) => a.time - b.time);
      ctx.moveTo((sorted[0].time / duration) * w, h - ((sorted[0].frequency - 50) / 500) * h);
      for (let i = 1; i < sorted.length; i++) {
        ctx.lineTo((sorted[i].time / duration) * w, h - ((sorted[i].frequency - 50) / 500) * h);
      }
      ctx.stroke();
    }
  }, [pitchTier, pitchData, duration]);

  // Draw duration tier canvas
  useEffect(() => {
    const canvas = durCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Draw baseline at factor=1
    const baseY = h / 2;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText('1.0×', 2, baseY - 4);

    // Draw duration tier points
    ctx.fillStyle = '#ff6b6b';
    for (let i = 0; i < durationTier.length; i++) {
      const x = (durationTier[i].time / duration) * w;
      const y = h - ((durationTier[i].factor - 0) / 3) * h; // 0-3x range
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (durationTier.length > 1) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sorted = [...durationTier].sort((a, b) => a.time - b.time);
      ctx.moveTo((sorted[0].time / duration) * w, h - ((sorted[0].factor) / 3) * h);
      for (let i = 1; i < sorted.length; i++) {
        ctx.lineTo((sorted[i].time / duration) * w, h - ((sorted[i].factor) / 3) * h);
      }
      ctx.stroke();
    }
  }, [durationTier, duration]);

  const handlePitchCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = pitchCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = (x / canvas.width) * duration;
    const freq = 50 + (1 - y / canvas.height) * 500;

    if (e.button === 2) {
      // Right-click: remove nearest point
      let nearest = -1;
      let minDist = Infinity;
      for (let i = 0; i < pitchTier.length; i++) {
        const px = (pitchTier[i].time / duration) * canvas.width;
        const py = canvas.height - ((pitchTier[i].frequency - 50) / 500) * canvas.height;
        const dist = Math.hypot(px - x, py - y);
        if (dist < minDist) { minDist = dist; nearest = i; }
      }
      if (nearest >= 0 && minDist < 15) {
        setPitchTier(pitchTier.filter((_, i) => i !== nearest));
      }
    } else {
      // Left-click: add point
      setPitchTier([...pitchTier, { time, frequency: Math.max(50, Math.min(550, freq)) }].sort((a, b) => a.time - b.time));
    }
  };

  const handleDurCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = durCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = (x / canvas.width) * duration;
    const factor = (1 - y / canvas.height) * 3;

    if (e.button === 2) {
      let nearest = -1;
      let minDist = Infinity;
      for (let i = 0; i < durationTier.length; i++) {
        const px = (durationTier[i].time / duration) * canvas.width;
        const py = canvas.height - (durationTier[i].factor / 3) * canvas.height;
        const dist = Math.hypot(px - x, py - y);
        if (dist < minDist) { minDist = dist; nearest = i; }
      }
      if (nearest >= 0 && minDist < 15) {
        setDurationTier(durationTier.filter((_, i) => i !== nearest));
      }
    } else {
      setDurationTier([...durationTier, { time, factor: Math.max(0.1, Math.min(3, factor)) }].sort((a, b) => a.time - b.time));
    }
  };

  const handleApply = () => {
    const pulses = extractPulses(samples, sampleRate, pitchData);
    const result = synthesizePsola(samples, sampleRate, pulses, pitchTier, durationTier);
    onApply(result);
  };

  const handleReset = () => {
    initializePitchTier();
    setDurationTier([]);
  };

  return (
    <section className="panel">
      <h3>Manipulation</h3>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>Pitch Tier (click to add, right-click to remove)</span>
        <canvas
          ref={pitchCanvasRef}
          width={280}
          height={100}
          style={{ width: '100%', height: 100, borderRadius: 4, cursor: 'crosshair' }}
          onClick={handlePitchCanvasClick}
          onContextMenu={(e) => { e.preventDefault(); handlePitchCanvasClick(e); }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>Duration Tier (1.0× = unchanged)</span>
        <canvas
          ref={durCanvasRef}
          width={280}
          height={60}
          style={{ width: '100%', height: 60, borderRadius: 4, cursor: 'crosshair' }}
          onClick={handleDurCanvasClick}
          onContextMenu={(e) => { e.preventDefault(); handleDurCanvasClick(e); }}
        />
      </div>
      <div className="panel-actions">
        <button className="btn btn-secondary" onClick={handleReset}>
          Reset
        </button>
        <button className="btn btn-primary" onClick={handleApply}>
          Apply
        </button>
      </div>
    </section>
  );
}
