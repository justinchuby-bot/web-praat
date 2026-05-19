import { useState, useCallback, useRef, useEffect } from 'react';
import {
  PitchPoint,
  DurationPoint,
  ManipulationState,
  psolaResynthesize,
  detectPitchMarks,
} from '../audio/psola';

interface ManipulationEditorProps {
  samples: Float32Array;
  sampleRate: number;
  onSynthesized?: (output: Float32Array) => void;
}

/**
 * ManipulationEditor — Praat-style pitch/duration editing panel.
 * Users can drag pitch points, add/delete points, and resynthesize.
 */
export default function ManipulationEditor({ samples, sampleRate, onSynthesized }: ManipulationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pitchTier, setPitchTier] = useState<PitchPoint[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [durationTier, _setDurationTier] = useState<DurationPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const duration = samples.length / sampleRate;
  const minF0 = 50;
  const maxF0 = 500;

  // Initialize pitch tier from detected pitch
  useEffect(() => {
    if (samples.length === 0) return;
    const marks = detectPitchMarks(samples, sampleRate);
    const points: PitchPoint[] = [];
    for (let i = 0; i < marks.length - 1; i++) {
      const period = (marks[i + 1] - marks[i]) / sampleRate;
      const freq = 1 / period;
      if (freq >= minF0 && freq <= maxF0) {
        points.push({ time: marks[i] / sampleRate, frequency: freq });
      }
    }
    // Downsample to ~20 points for editing
    const step = Math.max(1, Math.floor(points.length / 20));
    const downsampled = points.filter((_, i) => i % step === 0);
    setPitchTier(downsampled);
  }, [samples, sampleRate]);

  // Draw the editor canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const pitchHeight = height * 0.65;
    const durationHeight = height * 0.3;
    const gap = height * 0.05;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, pitchHeight);
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, pitchHeight + gap, width, durationHeight);

    // Pitch tier
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < pitchTier.length; i++) {
      const x = (pitchTier[i].time / duration) * width;
      const y = pitchHeight - ((pitchTier[i].frequency - minF0) / (maxF0 - minF0)) * pitchHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Pitch points
    for (let i = 0; i < pitchTier.length; i++) {
      const x = (pitchTier[i].time / duration) * width;
      const y = pitchHeight - ((pitchTier[i].frequency - minF0) / (maxF0 - minF0)) * pitchHeight;
      ctx.beginPath();
      ctx.arc(x, y, selectedPoint === i ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = selectedPoint === i ? '#ff6b6b' : '#00d4ff';
      ctx.fill();
    }

    // Duration tier
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 1.5;
    const durY0 = pitchHeight + gap;
    ctx.beginPath();
    for (let i = 0; i < durationTier.length; i++) {
      const x = (durationTier[i].time / duration) * width;
      const y = durY0 + durationHeight - ((durationTier[i].factor - 0.5) / 1.5) * durationHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#ccc';
    ctx.font = '11px monospace';
    ctx.fillText('Pitch (Hz)', 4, 14);
    ctx.fillText(`${maxF0}`, 4, 26);
    ctx.fillText(`${minF0}`, 4, pitchHeight - 4);
    ctx.fillText('Duration', 4, durY0 + 14);
  }, [pitchTier, durationTier, selectedPoint, duration]);

  useEffect(() => { draw(); }, [draw]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: canvas.width,
      height: canvas.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, width, height } = getCanvasCoords(e);
    const pitchHeight = height * 0.65;

    // Check if clicking near a pitch point
    for (let i = 0; i < pitchTier.length; i++) {
      const px = (pitchTier[i].time / duration) * width;
      const py = pitchHeight - ((pitchTier[i].frequency - minF0) / (maxF0 - minF0)) * pitchHeight;
      if (Math.hypot(x - px, y - py) < 10) {
        setSelectedPoint(i);
        setDragging(true);
        return;
      }
    }

    // Add new point on double-click handled separately
    setSelectedPoint(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || selectedPoint === null) return;
    const { x, y, width, height } = getCanvasCoords(e);
    const pitchHeight = height * 0.65;

    const time = Math.max(0, Math.min(duration, (x / width) * duration));
    const freq = Math.max(minF0, Math.min(maxF0, minF0 + (1 - y / pitchHeight) * (maxF0 - minF0)));

    const newTier = [...pitchTier];
    newTier[selectedPoint] = { time, frequency: freq };
    setPitchTier(newTier);
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, width, height } = getCanvasCoords(e);
    const pitchHeight = height * 0.65;

    if (y <= pitchHeight) {
      const time = (x / width) * duration;
      const freq = minF0 + (1 - y / pitchHeight) * (maxF0 - minF0);
      const newTier = [...pitchTier, { time, frequency: freq }].sort((a, b) => a.time - b.time);
      setPitchTier(newTier);
    }
  };

  const deleteSelected = () => {
    if (selectedPoint !== null) {
      const newTier = pitchTier.filter((_, i) => i !== selectedPoint);
      setPitchTier(newTier);
      setSelectedPoint(null);
    }
  };

  const resynthesize = async () => {
    const state: ManipulationState = {
      sampleRate,
      originalSamples: samples,
      pitchTier,
      durationTier,
    };
    const output = psolaResynthesize(state);
    onSynthesized?.(output);

    // Play the result
    const audioCtx = new AudioContext({ sampleRate });
    const buffer = audioCtx.createBuffer(1, output.length, sampleRate);
    buffer.getChannelData(0).set(output);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    setIsPlaying(true);
    source.onended = () => setIsPlaying(false);
    source.start();
  };

  return (
    <div className="manipulation-editor flex flex-col gap-2 p-2 bg-gray-900 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <span className="font-semibold">Manipulation Editor</span>
        <button
          onClick={resynthesize}
          disabled={isPlaying}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs disabled:opacity-50"
        >
          {isPlaying ? '▶ Playing...' : '▶ Resynthesize & Play'}
        </button>
        <button
          onClick={deleteSelected}
          disabled={selectedPoint === null}
          className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-white text-xs disabled:opacity-50"
        >
          Delete Point
        </button>
        <span className="text-xs text-gray-500 ml-auto">
          Double-click to add • Drag to move • Del to remove
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full rounded border border-gray-700 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}
