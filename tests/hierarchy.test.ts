import { describe, it, expect } from 'vitest';
import {
  getParentTier,
  getChildTiers,
  getAncestorIds,
  wouldCreateCycle,
  getTierDepth,
  validateChildBoundaries,
  validateChildPoints,
  validateHierarchy,
  setTierParent,
  buildTierTree,
  flattenTierTree,
} from '../src/textgrid/hierarchy';
import type { TextGrid, IntervalTier, PointTier } from '../src/types';

function makeGrid(): TextGrid {
  const word: IntervalTier = {
    id: 'word',
    name: 'Word',
    kind: 'interval',
    intervals: [
      { id: 'w1', start: 0, end: 0.5, label: 'hello' },
      { id: 'w2', start: 0.5, end: 1.0, label: 'world' },
    ],
  };
  const syllable: IntervalTier = {
    id: 'syllable',
    name: 'Syllable',
    kind: 'interval',
    parentId: 'word',
    intervals: [
      { id: 's1', start: 0, end: 0.25, label: 'hel' },
      { id: 's2', start: 0.25, end: 0.5, label: 'lo' },
      { id: 's3', start: 0.5, end: 0.75, label: 'wor' },
      { id: 's4', start: 0.75, end: 1.0, label: 'ld' },
    ],
  };
  const phone: PointTier = {
    id: 'phone',
    name: 'Phone',
    kind: 'point',
    parentId: 'syllable',
    points: [
      { id: 'p1', time: 0.1, label: 'h' },
      { id: 'p2', time: 0.3, label: 'l' },
      { id: 'p3', time: 0.6, label: 'w' },
    ],
  };
  return { xmin: 0, xmax: 1, tiers: [word, syllable, phone] };
}

describe('Hierarchical tiers', () => {
  describe('getParentTier', () => {
    it('returns parent for child tier', () => {
      const grid = makeGrid();
      const parent = getParentTier(grid, 'syllable');
      expect(parent?.id).toBe('word');
    });

    it('returns null for root tier', () => {
      const grid = makeGrid();
      expect(getParentTier(grid, 'word')).toBeNull();
    });
  });

  describe('getChildTiers', () => {
    it('returns direct children', () => {
      const grid = makeGrid();
      const children = getChildTiers(grid, 'word');
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe('syllable');
    });

    it('returns empty for leaf tier', () => {
      const grid = makeGrid();
      expect(getChildTiers(grid, 'phone')).toHaveLength(0);
    });
  });

  describe('getAncestorIds', () => {
    it('returns all ancestors', () => {
      const grid = makeGrid();
      expect(getAncestorIds(grid, 'phone')).toEqual(['syllable', 'word']);
    });

    it('returns empty for root', () => {
      const grid = makeGrid();
      expect(getAncestorIds(grid, 'word')).toEqual([]);
    });
  });

  describe('wouldCreateCycle', () => {
    it('detects self-reference', () => {
      const grid = makeGrid();
      expect(wouldCreateCycle(grid, 'word', 'word')).toBe(true);
    });

    it('detects cycle through descendants', () => {
      const grid = makeGrid();
      // Making word a child of phone would create cycle
      expect(wouldCreateCycle(grid, 'word', 'phone')).toBe(true);
    });

    it('allows valid parent assignment', () => {
      const grid = makeGrid();
      expect(wouldCreateCycle(grid, 'phone', 'word')).toBe(false);
    });
  });

  describe('getTierDepth', () => {
    it('returns correct depths', () => {
      const grid = makeGrid();
      expect(getTierDepth(grid, 'word')).toBe(0);
      expect(getTierDepth(grid, 'syllable')).toBe(1);
      expect(getTierDepth(grid, 'phone')).toBe(2);
    });
  });

  describe('validateChildBoundaries', () => {
    it('valid subdivision passes', () => {
      const grid = makeGrid();
      const parent = grid.tiers[0] as IntervalTier;
      const child = grid.tiers[1] as IntervalTier;
      const result = validateChildBoundaries(parent, child);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('crossing parent boundary fails', () => {
      const parent: IntervalTier = {
        id: 'p', name: 'P', kind: 'interval',
        intervals: [
          { id: 'i1', start: 0, end: 0.5, label: 'a' },
          { id: 'i2', start: 0.5, end: 1.0, label: 'b' },
        ],
      };
      const child: IntervalTier = {
        id: 'c', name: 'C', kind: 'interval', parentId: 'p',
        intervals: [
          { id: 'ci1', start: 0, end: 0.7, label: 'x' }, // crosses 0.5 boundary
          { id: 'ci2', start: 0.7, end: 1.0, label: 'y' },
        ],
      };
      const result = validateChildBoundaries(parent, child);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateChildPoints', () => {
    it('valid points pass', () => {
      const grid = makeGrid();
      const parent = grid.tiers[1] as IntervalTier;
      const child = grid.tiers[2] as PointTier;
      const result = validateChildPoints(parent, child);
      expect(result.valid).toBe(true);
    });

    it('point outside parent fails', () => {
      const parent: IntervalTier = {
        id: 'p', name: 'P', kind: 'interval',
        intervals: [{ id: 'i1', start: 0.2, end: 0.8, label: '' }],
      };
      const child: PointTier = {
        id: 'c', name: 'C', kind: 'point', parentId: 'p',
        points: [{ id: 'pt1', time: 0.1, label: 'x' }], // outside
      };
      const result = validateChildPoints(parent, child);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateHierarchy', () => {
    it('valid hierarchy passes', () => {
      const grid = makeGrid();
      const result = validateHierarchy(grid);
      expect(result.valid).toBe(true);
    });

    it('non-existent parent fails', () => {
      const grid: TextGrid = {
        xmin: 0, xmax: 1,
        tiers: [{
          id: 't1', name: 'T1', kind: 'interval', parentId: 'ghost',
          intervals: [{ id: 'i', start: 0, end: 1, label: '' }],
        }],
      };
      const result = validateHierarchy(grid);
      expect(result.valid).toBe(false);
    });

    it('point tier as parent fails', () => {
      const grid: TextGrid = {
        xmin: 0, xmax: 1,
        tiers: [
          { id: 'pt', name: 'PT', kind: 'point', points: [] },
          { id: 'child', name: 'Child', kind: 'interval', parentId: 'pt', intervals: [{ id: 'i', start: 0, end: 1, label: '' }] },
        ],
      };
      const result = validateHierarchy(grid);
      expect(result.valid).toBe(false);
    });
  });

  describe('setTierParent', () => {
    it('sets valid parent', () => {
      const grid: TextGrid = {
        xmin: 0, xmax: 1,
        tiers: [
          { id: 'a', name: 'A', kind: 'interval', intervals: [{ id: 'i', start: 0, end: 1, label: '' }] },
          { id: 'b', name: 'B', kind: 'interval', intervals: [{ id: 'j', start: 0, end: 1, label: '' }] },
        ],
      };
      const result = setTierParent(grid, 'b', 'a');
      expect(result).not.toBeNull();
      expect(result!.tiers[1].parentId).toBe('a');
    });

    it('removes parent', () => {
      const grid = makeGrid();
      const result = setTierParent(grid, 'syllable', null);
      expect(result).not.toBeNull();
      expect(result!.tiers[1].parentId).toBeUndefined();
    });

    it('rejects cycle', () => {
      const grid = makeGrid();
      const result = setTierParent(grid, 'word', 'phone');
      expect(result).toBeNull();
    });

    it('rejects point tier as parent', () => {
      const grid = makeGrid();
      const result = setTierParent(grid, 'word', 'phone');
      expect(result).toBeNull();
    });
  });

  describe('buildTierTree / flattenTierTree', () => {
    it('builds correct tree', () => {
      const grid = makeGrid();
      const tree = buildTierTree(grid);
      expect(tree).toHaveLength(1); // one root
      expect(tree[0].tier.id).toBe('word');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].tier.id).toBe('syllable');
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].tier.id).toBe('phone');
    });

    it('flattens in depth-first order', () => {
      const grid = makeGrid();
      const tree = buildTierTree(grid);
      const flat = flattenTierTree(tree);
      expect(flat.map((f) => f.tier.id)).toEqual(['word', 'syllable', 'phone']);
      expect(flat.map((f) => f.depth)).toEqual([0, 1, 2]);
    });
  });
});
