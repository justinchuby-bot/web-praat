import { describe, expect, it } from 'vitest';
import {
  addPointToTier,
  moveBoundary,
  movePoint,
  parseTextGrid,
  serializeTextGrid,
  splitIntervalTierBoundary,
  updateTextGridLabel,
} from '../src/textgrid/parser';
import { createEmptyTextGrid } from '../src/audio/defaults';

describe('TextGrid parser and serializer', () => {
  it('round-trips a simple interval and point tier', () => {
    const text = `File type = "ooTextFile"
Object class = "TextGrid"

xmin = 0
xmax = 1
tiers? <exists>
size = 2
item []:
    item [1]:
        class = "IntervalTier"
        name = "Words"
        xmin = 0
        xmax = 1
        intervals: size = 1
        intervals [1]:
            xmin = 0
            xmax = 1
            text = "hello"
    item [2]:
        class = "TextTier"
        name = "Events"
        xmin = 0
        xmax = 1
        points: size = 1
        points [1]:
            number = 0.5
            mark = "p"
`;
    const parsed = parseTextGrid(text);
    expect(parsed.tiers).toHaveLength(2);
    expect(parsed.tiers[0].kind).toBe('interval');
    expect(parsed.tiers[1].kind).toBe('point');

    const serialized = serializeTextGrid(parsed);
    expect(serialized).toContain('IntervalTier');
    expect(serialized).toContain('TextTier');
    expect(serialized).toContain('"hello"');
    expect(serialized).toContain('"p"');
  });

  it('splits interval tiers and edits labels', () => {
    let grid = createEmptyTextGrid(1);
    const tierId = grid.tiers[0].id;
    grid = splitIntervalTierBoundary(grid, tierId, 0.4);
    const tier = grid.tiers[0];
    expect(tier.kind).toBe('interval');
    if (tier.kind === 'interval') {
      expect(tier.intervals).toHaveLength(2);
      expect(tier.intervals[0].end).toBeCloseTo(0.4);
      grid = updateTextGridLabel(grid, tierId, tier.intervals[1].id, 'world');
      const updated = grid.tiers[0];
      expect(updated.kind).toBe('interval');
      if (updated.kind === 'interval') {
        expect(updated.intervals[1].label).toBe('world');
      }
    }
  });

  it('adds and moves points and boundaries', () => {
    let grid = createEmptyTextGrid(1);
    const intervalTierId = grid.tiers[0].id;
    const pointTierId = grid.tiers[1].id;
    grid = splitIntervalTierBoundary(grid, intervalTierId, 0.3);
    grid = moveBoundary(grid, intervalTierId, 1, 0.5);
    const intervalTier = grid.tiers[0];
    expect(intervalTier.kind).toBe('interval');
    if (intervalTier.kind === 'interval') {
      expect(intervalTier.intervals[0].end).toBeCloseTo(0.5);
    }

    grid = addPointToTier(grid, pointTierId, 0.2, 'a');
    const pointTier = grid.tiers[1];
    expect(pointTier.kind).toBe('point');
    if (pointTier.kind === 'point') {
      grid = movePoint(grid, pointTierId, pointTier.points[0].id, 0.7);
      const movedTier = grid.tiers[1];
      expect(movedTier.kind).toBe('point');
      if (movedTier.kind === 'point') {
        expect(movedTier.points[0].time).toBeCloseTo(0.7);
      }
    }
  });
});
