import { describe, it, expect } from 'vitest';
import { exportIntervalStatsCsv } from '../src/export';
import type { IntervalTier, PitchData, IntensityData, FormantData, HarmonicityData } from '../src/types';

function makeTier(): IntervalTier {
  return {
    id: 't1',
    name: 'words',
    kind: 'interval',
    intervals: [
      { id: 'i1', start: 0, end: 0.5, label: 'hello' },
      { id: 'i2', start: 0.5, end: 1.0, label: '' },
      { id: 'i3', start: 1.0, end: 1.5, label: 'world' },
    ],
  };
}

function makePitch(): PitchData {
  // 10 evenly-spaced frames from 0.05 to 1.45
  const times = Array.from({ length: 15 }, (_, i) => 0.05 + i * 0.1);
  const frequencies = times.map((t) => (t < 1.0 ? 120 + t * 10 : undefined));
  return { times, frequencies } as unknown as PitchData;
}

function makeIntensity(): IntensityData {
  const times = Array.from({ length: 15 }, (_, i) => 0.05 + i * 0.1);
  const values = times.map(() => 70);
  return { times, values } as unknown as IntensityData;
}

describe('exportIntervalStatsCsv', () => {
  it('produces correct CSV header with pitch only', () => {
    const csv = exportIntervalStatsCsv({ tier: makeTier(), pitch: makePitch() });
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('interval,label,start_s,end_s,duration_s,pitch_mean_hz,pitch_stdev_hz,pitch_n');
    expect(lines.length).toBe(4); // header + 3 intervals
  });

  it('computes stats per interval', () => {
    const csv = exportIntervalStatsCsv({ tier: makeTier(), pitch: makePitch() });
    const lines = csv.trim().split('\n');
    const row1 = lines[1].split(',');
    expect(row1[0]).toBe('1');
    expect(row1[1]).toBe('hello');
    expect(row1[2]).toBe('0.0000');
    expect(row1[3]).toBe('0.5000');
    // pitch_n should be 5 (frames at 0.05,0.15,0.25,0.35,0.45)
    expect(row1[7]).toBe('5');
  });

  it('handles empty intervals (no voiced frames)', () => {
    const csv = exportIntervalStatsCsv({ tier: makeTier(), pitch: makePitch() });
    const lines = csv.trim().split('\n');
    // Third interval (1.0-1.5) has undefined pitch
    const row3 = lines[3].split(',');
    expect(row3[5]).toBe(''); // mean empty
    expect(row3[6]).toBe(''); // stdev empty
    expect(row3[7]).toBe('0');
  });

  it('includes intensity columns', () => {
    const csv = exportIntervalStatsCsv({ tier: makeTier(), intensity: makeIntensity() });
    const header = csv.split('\n')[0];
    expect(header).toContain('intensity_mean_db');
  });

  it('works with all analyses combined', () => {
    const formants: FormantData = {
      times: [0.1, 0.3, 0.6, 1.2],
      f1: [500, 520, 480, 510],
      f2: [1500, 1520, 1480, 1510],
      f3: [2500, 2520, 2480, 2510],
    } as unknown as FormantData;
    const harmonicity: HarmonicityData = {
      times: [0.1, 0.3, 0.6, 1.2],
      values: [15, 18, -200, 20],
    } as unknown as HarmonicityData;
    const csv = exportIntervalStatsCsv({
      tier: makeTier(),
      pitch: makePitch(),
      intensity: makeIntensity(),
      formants,
      harmonicity,
    });
    const header = csv.split('\n')[0];
    expect(header).toContain('hnr_mean_db');
    expect(header).toContain('f1_mean_hz');
    // Second interval harmonicity should filter out -200
    const row2 = csv.trim().split('\n')[2];
    expect(row2).toContain('0.5000');
  });

  it('escapes labels with commas', () => {
    const tier: IntervalTier = {
      id: 't1',
      name: 'test',
      kind: 'interval',
      intervals: [{ id: 'i1', start: 0, end: 1, label: 'a,b' }],
    };
    const csv = exportIntervalStatsCsv({ tier });
    expect(csv).toContain('"a,b"');
  });
});
