import { useRef, useEffect } from 'react';
import type { AnalysisResult, TimeSelection } from '../types';

interface WaveformProps {
  analysis: AnalysisResult | null;
  selection: TimeSelection | null;
  currentTime: number;
  onSelectionChange: (sel: TimeSelection | null) => void;
}

export function Waveform({ analysis, selection, currentTime, onSelectionChange }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Background
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, width, height);

    const { waveform, duration } = analysis;
    const samplesPerPixel = Math.ceil(waveform.length / width);

    // Draw waveform
    ctx.strokeStyle = '#89b4fa';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const start = Math.floor((x / width) * waveform.length);
      const end = Math.min(start + samplesPerPixel, waveform.length);
      let min = 1, max = -1;
      for (let i = start; i < end; i++) {
        if (waveform[i] < min) min = waveform[i];
        if (waveform[i] > max) max = waveform[i];
      }
      const yMin = ((1 - max) / 2) * height;
      const yMax = ((1 - min) / 2) * height;
      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
    }
    ctx.stroke();

    // Selection highlight
    if (selection) {
      const x1 = (selection.start / duration) * width;
      const x2 = (selection.end / duration) * width;
      ctx.fillStyle = 'rgba(137, 180, 250, 0.15)';
      ctx.fillRect(x1, 0, x2 - x1, height);
    }

    // Playback cursor
    if (currentTime > 0) {
      const cx = (currentTime / duration) * width;
      ctx.strokeStyle = '#f38ba8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = '#45475a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [analysis, selection, currentTime]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!analysis) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * analysis.duration;
    isDragging.current = true;
    dragStart.current = time;
    onSelectionChange(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !analysis) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min((x / rect.width) * analysis.duration, analysis.duration));
    const start = Math.min(dragStart.current, time);
    const end = Math.max(dragStart.current, time);
    if (end - start > 0.005) {
      onSelectionChange({ start, end });
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      className="waveform-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
