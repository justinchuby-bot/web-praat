import type { TimeSelection, ViewRange } from '../types';

export function clampViewRange(range: ViewRange, duration: number, minWindow = 0.01): ViewRange {
  const safeDuration = Math.max(duration, minWindow);
  const width = Math.max(minWindow, Math.min(range.end - range.start, safeDuration));
  let start = Math.max(0, range.start);
  let end = start + width;
  if (end > safeDuration) {
    end = safeDuration;
    start = Math.max(0, end - width);
  }
  return { start, end };
}

export function fitToWindow(duration: number): ViewRange {
  return { start: 0, end: Math.max(duration, 0.01) };
}

export function zoomAroundPoint(
  range: ViewRange,
  pivotTime: number,
  zoomFactor: number,
  duration: number
): ViewRange {
  const width = Math.max(0.01, (range.end - range.start) * zoomFactor);
  const relative = (pivotTime - range.start) / Math.max(range.end - range.start, 1e-6);
  const start = pivotTime - width * relative;
  return clampViewRange({ start, end: start + width }, duration);
}

export function panViewRange(range: ViewRange, deltaTime: number, duration: number): ViewRange {
  return clampViewRange(
    {
      start: range.start + deltaTime,
      end: range.end + deltaTime,
    },
    duration
  );
}

export function selectionToView(selection: TimeSelection, duration: number): ViewRange {
  return clampViewRange({ start: selection.start, end: selection.end }, duration);
}

export function xToTime(x: number, width: number, range: ViewRange): number {
  const ratio = width > 0 ? x / width : 0;
  return range.start + ratio * (range.end - range.start);
}

export function timeToX(time: number, width: number, range: ViewRange): number {
  const ratio = (time - range.start) / Math.max(range.end - range.start, 1e-6);
  return ratio * width;
}
