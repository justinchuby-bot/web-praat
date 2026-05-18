import { describe, expect, it } from 'vitest';
import { clampViewRange, fitToWindow, panViewRange, selectionToView, xToTime, timeToX, zoomAroundPoint } from '../src/utils/view';

describe('zoom math', () => {
  it('zooms around a pivot while staying in bounds', () => {
    const range = zoomAroundPoint({ start: 0, end: 10 }, 5, 0.5, 10);
    expect(range.start).toBeCloseTo(2.5);
    expect(range.end).toBeCloseTo(7.5);
  });

  it('pans and clamps to the audio duration', () => {
    const fitted = fitToWindow(8);
    expect(fitted).toEqual({ start: 0, end: 8 });
    const panned = panViewRange({ start: 2, end: 6 }, 5, 8);
    expect(panned.start).toBeCloseTo(4);
    expect(panned.end).toBeCloseTo(8);
  });

  it('zoom out does not exceed duration', () => {
    const range = zoomAroundPoint({ start: 2, end: 4 }, 3, 10, 5);
    expect(range.start).toBeGreaterThanOrEqual(0);
    expect(range.end).toBeLessThanOrEqual(5);
  });

  it('pan left does not go below zero', () => {
    const panned = panViewRange({ start: 0, end: 2 }, -5, 10);
    expect(panned.start).toBe(0);
    expect(panned.end).toBe(2);
  });

  it('clampViewRange enforces minWindow', () => {
    const range = clampViewRange({ start: 5, end: 5 }, 10);
    expect(range.end - range.start).toBeCloseTo(0.01);
  });

  it('selectionToView zooms to selection', () => {
    const view = selectionToView({ start: 1, end: 3 }, 10);
    expect(view.start).toBeCloseTo(1);
    expect(view.end).toBeCloseTo(3);
  });

  it('xToTime and timeToX are inverses', () => {
    const range = { start: 2, end: 6 };
    const time = xToTime(150, 600, range);
    const x = timeToX(time, 600, range);
    expect(x).toBeCloseTo(150);
  });

  it('trackpad horizontal scroll semantics (small increments pan correctly)', () => {
    // Simulates small incremental pans like trackpad generates
    let range = { start: 2, end: 6 };
    for (let i = 0; i < 10; i++) {
      range = panViewRange(range, 0.05, 10);
    }
    expect(range.start).toBeCloseTo(2.5);
    expect(range.end).toBeCloseTo(6.5);
  });
});
