/**
 * Hierarchical tiers — parent-child relationships (inspired by ELAN).
 *
 * Rules:
 * - A child tier's boundaries must align with (subdivide) the parent tier's intervals.
 * - Point tiers can be children of interval tiers (points must fall within parent intervals).
 * - Interval tiers can be children of interval tiers (boundaries must be subset of parent boundaries + subdivisions).
 * - Circular references are not allowed.
 * - A tier with no parentId is a root tier.
 */

import type { TextGrid, TextGridTier, IntervalTier, PointTier } from '../types';

/** Get the parent tier of a given tier, or null if it's a root. */
export function getParentTier(grid: TextGrid, tierId: string): TextGridTier | null {
  const tier = grid.tiers.find((t) => t.id === tierId);
  if (!tier || !tier.parentId) return null;
  return grid.tiers.find((t) => t.id === tier.parentId) || null;
}

/** Get direct children of a tier. */
export function getChildTiers(grid: TextGrid, tierId: string): TextGridTier[] {
  return grid.tiers.filter((t) => t.parentId === tierId);
}

/** Get all ancestor tier IDs (for cycle detection). */
export function getAncestorIds(grid: TextGrid, tierId: string): string[] {
  const ancestors: string[] = [];
  let current = grid.tiers.find((t) => t.id === tierId);
  while (current?.parentId) {
    if (ancestors.includes(current.parentId)) break; // cycle guard
    ancestors.push(current.parentId);
    current = grid.tiers.find((t) => t.id === current!.parentId);
  }
  return ancestors;
}

/** Check if setting parentId would create a cycle. */
export function wouldCreateCycle(grid: TextGrid, tierId: string, parentId: string): boolean {
  if (tierId === parentId) return true;
  // Check if tierId is an ancestor of parentId
  const ancestors = getAncestorIds(grid, parentId);
  return ancestors.includes(tierId) || parentId === tierId;
}

/** Get the depth of a tier in the hierarchy (0 = root). */
export function getTierDepth(grid: TextGrid, tierId: string): number {
  return getAncestorIds(grid, tierId).length;
}

/**
 * Validate that a child interval tier's boundaries align with parent.
 * Child boundaries must fall on parent boundaries or within parent intervals.
 */
export function validateChildBoundaries(
  parent: IntervalTier,
  child: IntervalTier,
  tolerance = 1e-6
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const parentBoundaries = new Set<number>();
  for (const interval of parent.intervals) {
    parentBoundaries.add(interval.start);
    parentBoundaries.add(interval.end);
  }

  // Each child boundary must fall on a parent boundary or within a parent interval
  for (const interval of child.intervals) {
    // Check that child interval is contained within exactly one parent interval
    const containingParent = parent.intervals.find(
      (p) => interval.start >= p.start - tolerance && interval.end <= p.end + tolerance
    );
    if (!containingParent) {
      errors.push(
        `Child interval [${interval.start.toFixed(3)}, ${interval.end.toFixed(3)}] "${interval.label}" ` +
          `crosses parent boundary`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that a child point tier's points fall within parent intervals.
 */
export function validateChildPoints(
  parent: IntervalTier,
  child: PointTier,
  tolerance = 1e-6
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const point of child.points) {
    const containingParent = parent.intervals.find(
      (p) => point.time >= p.start - tolerance && point.time <= p.end + tolerance
    );
    if (!containingParent) {
      errors.push(
        `Point at ${point.time.toFixed(3)} "${point.label}" is outside all parent intervals`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate entire hierarchy of a TextGrid.
 */
export function validateHierarchy(grid: TextGrid): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];

  for (const tier of grid.tiers) {
    if (!tier.parentId) continue;

    const parent = grid.tiers.find((t) => t.id === tier.parentId);
    if (!parent) {
      allErrors.push(`Tier "${tier.name}" references non-existent parent ID "${tier.parentId}"`);
      continue;
    }

    if (parent.kind !== 'interval') {
      allErrors.push(`Tier "${tier.name}" has a point tier as parent (only interval parents allowed)`);
      continue;
    }

    // Check for cycles
    if (wouldCreateCycle(grid, tier.id, tier.parentId)) {
      allErrors.push(`Tier "${tier.name}" creates a cycle in hierarchy`);
      continue;
    }

    if (tier.kind === 'interval') {
      const result = validateChildBoundaries(parent as IntervalTier, tier);
      allErrors.push(...result.errors.map((e) => `${tier.name}: ${e}`));
    } else {
      const result = validateChildPoints(parent as IntervalTier, tier as PointTier);
      allErrors.push(...result.errors.map((e) => `${tier.name}: ${e}`));
    }
  }

  return { valid: allErrors.length === 0, errors: allErrors };
}

/**
 * Set parent of a tier. Returns null if the operation would be invalid.
 */
export function setTierParent(
  grid: TextGrid,
  tierId: string,
  parentId: string | null
): TextGrid | null {
  const tier = grid.tiers.find((t) => t.id === tierId);
  if (!tier) return null;

  if (parentId === null) {
    // Remove parent
    return {
      ...grid,
      tiers: grid.tiers.map((t) =>
        t.id === tierId ? { ...t, parentId: undefined } : t
      ),
    };
  }

  const parent = grid.tiers.find((t) => t.id === parentId);
  if (!parent) return null;
  if (parent.kind !== 'interval') return null; // only interval tiers can be parents
  if (wouldCreateCycle(grid, tierId, parentId)) return null;

  return {
    ...grid,
    tiers: grid.tiers.map((t) =>
      t.id === tierId ? { ...t, parentId } : t
    ),
  };
}

/**
 * Get tiers organized as a tree structure for display.
 */
export interface TierTreeNode {
  tier: TextGridTier;
  depth: number;
  children: TierTreeNode[];
}

export function buildTierTree(grid: TextGrid): TierTreeNode[] {
  const roots = grid.tiers.filter((t) => !t.parentId);
  const buildNode = (tier: TextGridTier, depth: number): TierTreeNode => {
    const children = grid.tiers
      .filter((t) => t.parentId === tier.id)
      .map((child) => buildNode(child, depth + 1));
    return { tier, depth, children };
  };
  return roots.map((r) => buildNode(r, 0));
}

/**
 * Flatten tree to display order (depth-first, children after parent).
 */
export function flattenTierTree(nodes: TierTreeNode[]): Array<{ tier: TextGridTier; depth: number }> {
  const result: Array<{ tier: TextGridTier; depth: number }> = [];
  const walk = (node: TierTreeNode) => {
    result.push({ tier: node.tier, depth: node.depth });
    for (const child of node.children) walk(child);
  };
  for (const root of nodes) walk(root);
  return result;
}
