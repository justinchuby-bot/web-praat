import type { Interval, Point, TextGrid, TextGridTier } from '../types';
import { createId } from '../utils/id';

function parseNumber(line: string): number {
  const match = line.match(/=\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
  if (!match) {
    throw new Error(`Invalid numeric line: ${line}`);
  }
  return Number(match[1]);
}

function parseString(line: string): string {
  const match = line.match(/=\s*"(.*)"\s*$/);
  if (!match) {
    throw new Error(`Invalid string line: ${line}`);
  }
  return match[1].replace(/\\"/g, '"');
}

function ensureIntervalCoverage(intervals: Interval[], xmin: number, xmax: number): Interval[] {
  if (intervals.length === 0) {
    return [{ id: createId('interval'), start: xmin, end: xmax, label: '' }];
  }
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  sorted[0].start = xmin;
  sorted[sorted.length - 1].end = xmax;
  for (let i = 0; i < sorted.length - 1; i++) {
    sorted[i].end = sorted[i + 1].start;
  }
  return sorted;
}

export function parseTextGrid(text: string): TextGrid {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const xminLine = lines.find((line) => line.startsWith('xmin ='));
  const xmaxLine = lines.find((line) => line.startsWith('xmax ='));
  if (!xminLine || !xmaxLine) {
    throw new Error('Invalid TextGrid: missing xmin/xmax');
  }

  const xmin = parseNumber(xminLine);
  const xmax = parseNumber(xmaxLine);
  const tiers: TextGridTier[] = [];

  let index = 0;
  while (index < lines.length) {
    if (lines[index] === 'item []:' || !lines[index].startsWith('item [')) {
      index++;
      continue;
    }

    const classLine = lines[index + 1];
    const nameLine = lines[index + 2];
    const tierClass = parseString(classLine);
    const tierName = parseString(nameLine);
    const nextTierIndex = lines.findIndex(
      (line, lineIndex) => lineIndex > index && line.startsWith('item [')
    );
    const tierEnd = nextTierIndex >= 0 ? nextTierIndex : lines.length;
    const tierLines = lines.slice(index, tierEnd);
    const sizeLineIndex = tierLines.findIndex((line) => line.startsWith('intervals: size ='));
    const pointSizeLineIndex = tierLines.findIndex((line) => line.startsWith('points: size ='));

    if (tierClass === 'IntervalTier') {
      const intervals: Interval[] = [];
      const sizeLine = sizeLineIndex >= 0 ? tierLines[sizeLineIndex] : null;
      const size = sizeLine ? parseNumber(sizeLine) : 0;
      let cursor = sizeLineIndex + 1;
      for (let count = 0; count < size; count++) {
        while (cursor < tierLines.length && !tierLines[cursor].startsWith('intervals [')) cursor++;
        const start = parseNumber(tierLines[cursor + 1]);
        const end = parseNumber(tierLines[cursor + 2]);
        const label = parseString(tierLines[cursor + 3]);
        intervals.push({ id: createId('interval'), start, end, label });
        cursor += 4;
      }
      tiers.push({
        id: createId('tier'),
        name: tierName,
        kind: 'interval',
        intervals: ensureIntervalCoverage(intervals, xmin, xmax),
      });
    } else if (tierClass === 'TextTier') {
      const points: Point[] = [];
      const sizeLine = pointSizeLineIndex >= 0 ? tierLines[pointSizeLineIndex] : null;
      const size = sizeLine ? parseNumber(sizeLine) : 0;
      let cursor = pointSizeLineIndex + 1;
      for (let count = 0; count < size; count++) {
        while (cursor < tierLines.length && !tierLines[cursor].startsWith('points [')) cursor++;
        const time = parseNumber(tierLines[cursor + 1]);
        const label = parseString(tierLines[cursor + 2]);
        points.push({ id: createId('point'), time, label });
        cursor += 3;
      }
      tiers.push({
        id: createId('tier'),
        name: tierName,
        kind: 'point',
        points,
      });
    }

    index = tierEnd;
  }

  return { xmin, xmax, tiers };
}

function escapeLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function serializeTextGrid(grid: TextGrid): string {
  const lines: string[] = [
    'File type = "ooTextFile"',
    'Object class = "TextGrid"',
    '',
    `xmin = ${grid.xmin}`,
    `xmax = ${grid.xmax}`,
    'tiers? <exists>',
    `size = ${grid.tiers.length}`,
    'item []:',
  ];

  grid.tiers.forEach((tier, tierIndex) => {
    lines.push(`    item [${tierIndex + 1}]:`);
    if (tier.kind === 'interval') {
      lines.push('        class = "IntervalTier"');
      lines.push(`        name = "${escapeLabel(tier.name)}"`);
      lines.push(`        xmin = ${grid.xmin}`);
      lines.push(`        xmax = ${grid.xmax}`);
      lines.push(`        intervals: size = ${tier.intervals.length}`);
      tier.intervals.forEach((interval, intervalIndex) => {
        lines.push(`        intervals [${intervalIndex + 1}]:`);
        lines.push(`            xmin = ${interval.start}`);
        lines.push(`            xmax = ${interval.end}`);
        lines.push(`            text = "${escapeLabel(interval.label)}"`);
      });
    } else {
      lines.push('        class = "TextTier"');
      lines.push(`        name = "${escapeLabel(tier.name)}"`);
      lines.push(`        xmin = ${grid.xmin}`);
      lines.push(`        xmax = ${grid.xmax}`);
      lines.push(`        points: size = ${tier.points.length}`);
      tier.points.forEach((point, pointIndex) => {
        lines.push(`        points [${pointIndex + 1}]:`);
        lines.push(`            number = ${point.time}`);
        lines.push(`            mark = "${escapeLabel(point.label)}"`);
      });
    }
  });

  return `${lines.join('\n')}\n`;
}

export function splitIntervalTierBoundary(grid: TextGrid, tierId: string, time: number): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((tier) => {
      if (tier.id !== tierId || tier.kind !== 'interval') return tier;
      const intervals = [...tier.intervals];
      const index = intervals.findIndex((interval) => time > interval.start && time < interval.end);
      if (index < 0) return tier;
      const interval = intervals[index];
      const left: Interval = {
        id: createId('interval'),
        start: interval.start,
        end: time,
        label: interval.label,
      };
      const right: Interval = {
        id: createId('interval'),
        start: time,
        end: interval.end,
        label: '',
      };
      intervals.splice(index, 1, left, right);
      return { ...tier, intervals };
    }),
  };
}

export function addPointToTier(grid: TextGrid, tierId: string, time: number, label = ''): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((tier) => {
      if (tier.id !== tierId || tier.kind !== 'point') return tier;
      return {
        ...tier,
        points: [...tier.points, { id: createId('point'), time, label }].sort((a, b) => a.time - b.time),
      };
    }),
  };
}

export function updateTextGridLabel(
  grid: TextGrid,
  tierId: string,
  itemId: string,
  label: string
): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((tier) => {
      if (tier.id !== tierId) return tier;
      if (tier.kind === 'interval') {
        return {
          ...tier,
          intervals: tier.intervals.map((interval) =>
            interval.id === itemId ? { ...interval, label } : interval
          ),
        };
      }
      return {
        ...tier,
        points: tier.points.map((point) => (point.id === itemId ? { ...point, label } : point)),
      };
    }),
  };
}

export function moveBoundary(grid: TextGrid, tierId: string, boundaryIndex: number, time: number): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((tier) => {
      if (tier.id !== tierId || tier.kind !== 'interval') return tier;
      if (boundaryIndex <= 0 || boundaryIndex >= tier.intervals.length) return tier;
      const intervals = [...tier.intervals];
      const previous = intervals[boundaryIndex - 1];
      const next = intervals[boundaryIndex];
      const epsilon = 1e-4;
      const clamped = Math.max(previous.start + epsilon, Math.min(next.end - epsilon, time));
      intervals[boundaryIndex - 1] = { ...previous, end: clamped };
      intervals[boundaryIndex] = { ...next, start: clamped };
      return { ...tier, intervals };
    }),
  };
}

export function movePoint(grid: TextGrid, tierId: string, pointId: string, time: number): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((tier) => {
      if (tier.id !== tierId || tier.kind !== 'point') return tier;
      const points = tier.points
        .map((point) =>
          point.id === pointId
            ? { ...point, time: Math.max(grid.xmin, Math.min(grid.xmax, time)) }
            : point
        )
        .sort((a, b) => a.time - b.time);
      return { ...tier, points };
    }),
  };
}

export function addTier(
  grid: TextGrid,
  name: string,
  kind: 'interval' | 'point'
): TextGrid {
  const id = createId('tier');
  const tier: TextGridTier =
    kind === 'interval'
      ? { id, name, kind: 'interval', intervals: [{ id: createId('interval'), start: grid.xmin, end: grid.xmax, label: '' }] }
      : { id, name, kind: 'point', points: [] };
  return { ...grid, tiers: [...grid.tiers, tier] };
}

export function removeTier(grid: TextGrid, tierId: string): TextGrid {
  return { ...grid, tiers: grid.tiers.filter((t) => t.id !== tierId) };
}

export function renameTier(grid: TextGrid, tierId: string, name: string): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((t) => (t.id === tierId ? { ...t, name } : t)),
  };
}

export function deleteBoundary(grid: TextGrid, tierId: string, boundaryIndex: number): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((tier) => {
      if (tier.id !== tierId || tier.kind !== 'interval') return tier;
      if (boundaryIndex <= 0 || boundaryIndex >= tier.intervals.length) return tier;
      const intervals = [...tier.intervals];
      const left = intervals[boundaryIndex - 1];
      const right = intervals[boundaryIndex];
      const merged: Interval = {
        id: left.id,
        start: left.start,
        end: right.end,
        label: left.label || right.label,
      };
      intervals.splice(boundaryIndex - 1, 2, merged);
      return { ...tier, intervals };
    }),
  };
}

export function deletePoint(grid: TextGrid, tierId: string, pointId: string): TextGrid {
  return {
    ...grid,
    tiers: grid.tiers.map((tier) => {
      if (tier.id !== tierId || tier.kind !== 'point') return tier;
      return { ...tier, points: tier.points.filter((p) => p.id !== pointId) };
    }),
  };
}
