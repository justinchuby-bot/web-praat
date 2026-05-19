import React, { useRef, useEffect, useCallback, useState } from 'react';

export interface TierPoint {
  time: number;
  value: number;
}

export interface TierTrack {
  points: TierPoint[];
  color: string;
  label: string;
}

export interface TierEditorBaseProps {
  /** Duration of the audio in seconds */
  duration: number;
  /** Tracks to render (each is a separate curve) */
  tracks: TierTrack[];
  /** Y-axis range */
  minValue: number;
  maxValue: number;
  /** Canvas dimensions */
  width?: number;
  height?: number;
  /** Callbacks */
  onPointMoved?: (trackIndex: number, pointIndex: number, newPoint: TierPoint) => void;
  onPointAdded?: (trackIndex: number, point: TierPoint) => void;
  onPointDeleted?: (trackIndex: number, pointIndex: number) => void;
  /** Labels */
  yLabel?: string;
  title?: string;
}

const POINT_RADIUS = 5;
const HIT_RADIUS = 10;

/**
 * TierEditorBase — shared canvas-based tier editor.
 * Features: drag points, double-click to add, Delete key to remove.
 */
export default function TierEditorBase({
  duration,
  tracks,
  minValue,
  maxValue,
  width = 800,
  height = 300,
  onPointMoved,
  onPointAdded,
  onPointDeleted,
  yLabel,
  title,
}: TierEditorBaseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<{ track: number; point: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const timeToX = useCallback((t: number) => (t / duration) * width, [duration, width]);
  const valueToY = useCallback(
    (v: number) => height - ((v - minValue) / (maxValue - minValue)) * height,
    [height, minValue, maxValue]
  );
  const xToTime = useCallback((x: number) => (x / width) * duration, [width, duration]);
  const yToValue = useCallback(
    (y: number) => minValue + ((height - y) / height) * (maxValue - minValue),
    [height, minValue, maxValue]
  );

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw each track
    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti];
      if (track.points.length === 0) continue;

      // Lines
      ctx.strokeStyle = track.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < track.points.length; i++) {
        const x = timeToX(track.points[i].time);
        const y = valueToY(track.points[i].value);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Points
      for (let i = 0; i < track.points.length; i++) {
        const x = timeToX(track.points[i].time);
        const y = valueToY(track.points[i].value);
        const isSelected = selected?.track === ti && selected?.point === i;

        ctx.beginPath();
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#fff' : track.color;
        ctx.fill();
        if (isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Y-axis label
    if (yLabel) {
      ctx.save();
      ctx.fillStyle = '#888';
      ctx.font = '11px sans-serif';
      ctx.translate(12, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }
  }, [tracks, width, height, timeToX, valueToY, selected, yLabel]);

  useEffect(() => {
    draw();
  }, [draw]);

  const findPoint = useCallback(
    (mx: number, my: number) => {
      for (let ti = 0; ti < tracks.length; ti++) {
        for (let pi = 0; pi < tracks[ti].points.length; pi++) {
          const x = timeToX(tracks[ti].points[pi].time);
          const y = valueToY(tracks[ti].points[pi].value);
          if (Math.hypot(mx - x, my - y) < HIT_RADIUS) {
            return { track: ti, point: pi };
          }
        }
      }
      return null;
    },
    [tracks, timeToX, valueToY]
  );

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasPos(e);
    const hit = findPoint(x, y);
    if (hit) {
      setSelected(hit);
      setDragging(true);
    } else {
      setSelected(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !selected) return;
    const { x, y } = getCanvasPos(e);
    const time = Math.max(0, Math.min(duration, xToTime(x)));
    const value = Math.max(minValue, Math.min(maxValue, yToValue(y)));
    onPointMoved?.(selected.track, selected.point, { time, value });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = getCanvasPos(e);
    const time = Math.max(0, Math.min(duration, xToTime(x)));
    const value = Math.max(minValue, Math.min(maxValue, yToValue(y)));
    // Add to the first track (or closest track for multi-track)
    const trackIndex = tracks.length === 1 ? 0 : findClosestTrack(y);
    onPointAdded?.(trackIndex, { time, value });
  };

  const findClosestTrack = (mouseY: number) => {
    let best = 0;
    let bestDist = Infinity;
    for (let ti = 0; ti < tracks.length; ti++) {
      for (const p of tracks[ti].points) {
        const py = valueToY(p.value);
        const d = Math.abs(py - mouseY);
        if (d < bestDist) {
          bestDist = d;
          best = ti;
        }
      }
    }
    return best;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selected) {
        onPointDeleted?.(selected.track, selected.point);
        setSelected(null);
      }
    }
  };

  return (
    <div className="tier-editor" data-testid="tier-editor">
      {title && <div className="text-sm text-gray-400 mb-1">{title}</div>}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        style={{ cursor: dragging ? 'grabbing' : 'crosshair', outline: 'none' }}
        data-testid="tier-canvas"
      />
    </div>
  );
}
