import { describe, expect, it } from 'vitest';
import { fitToWindow, panViewRange, zoomAroundPoint } from '../src/utils/view';

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
});
