import { useEffect, useRef } from 'react';
import type { ViewRange } from '../types';
import { timeToX } from '../utils/view';

interface TimeRulerProps {
  duration: number;
  viewRange: ViewRange;
}

export function TimeRuler({ duration, viewRange }: TimeRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#181825';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#45475a';
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();

    const visibleDuration = Math.max(viewRange.end - viewRange.start, 1e-6);
    const stepTargets = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
    const targetStep = visibleDuration / 8;
    const tickStep = stepTargets.find((step) => step >= targetStep) ?? 10;
    const firstTick = Math.ceil(viewRange.start / tickStep) * tickStep;

    ctx.font = '11px monospace';
    ctx.fillStyle = '#a6adc8';
    ctx.strokeStyle = '#6c7086';

    for (let time = firstTick; time <= Math.min(viewRange.end, duration) + 1e-6; time += tickStep) {
      const x = timeToX(time, width, viewRange);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height - 12);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
      ctx.fillText(`${time.toFixed(time < 1 ? 2 : 1)}s`, x + 4, 12);
    }
  }, [duration, viewRange]);

  return <canvas ref={canvasRef} className="time-ruler-canvas" />;
}
