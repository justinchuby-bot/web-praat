import { describe, expect, it } from 'vitest';
import {
  exportFormantCsv,
  exportIntensityCsv,
  exportPitchCsv,
  exportSelectedRegionWav,
  exportTextGrid,
} from '../src/export';
import { createEmptyTextGrid } from '../src/audio/defaults';

describe('export helpers', () => {
  it('writes a valid wav header', () => {
    const wav = exportSelectedRegionWav(new Float32Array([0, 0.5, -0.5]), 16000);
    const header = new TextDecoder().decode(wav.slice(0, 12));
    expect(header.startsWith('RIFF')).toBe(true);
    expect(header.includes('WAVE')).toBe(true);
  });

  it('formats csv series', () => {
    const pitchCsv = exportPitchCsv({ times: [0, 0.01], frequencies: [100, null] });
    const formantCsv = exportFormantCsv({
      times: [0],
      f1: [500],
      f2: [1500],
      f3: [2500],
      tracked: [[500], [1500], [2500]],
      candidates: [{ time: 0, candidates: [500, 1500, 2500] }],
    });
    const intensityCsv = exportIntensityCsv({ times: [0], values: [-12] });
    expect(pitchCsv).toContain('time,frequency_hz');
    expect(formantCsv).toContain('f1_hz');
    expect(intensityCsv).toContain('intensity_db');
  });

  it('formats TextGrid output', () => {
    const textGrid = createEmptyTextGrid(1);
    const text = exportTextGrid(textGrid);
    expect(text).toContain('Object class = "TextGrid"');
    expect(text).toContain('IntervalTier');
  });
});
