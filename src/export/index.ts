import { serializeTextGrid } from '../textgrid/parser';
import type { FormantData, HarmonicityData, IntensityData, IntervalTier, PitchData, TextGrid } from '../types';

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportTextGrid(grid: TextGrid): string {
  return serializeTextGrid(grid);
}

export function exportPitchCsv(pitch: PitchData): string {
  const rows = ['time,frequency_hz'];
  for (let i = 0; i < pitch.times.length; i++) {
    rows.push(`${pitch.times[i]},${pitch.frequencies[i] ?? ''}`);
  }
  return `${rows.join('\n')}\n`;
}

export function exportIntensityCsv(intensity: IntensityData): string {
  const rows = ['time,intensity_db'];
  for (let i = 0; i < intensity.times.length; i++) {
    rows.push(`${intensity.times[i]},${intensity.values[i]}`);
  }
  return `${rows.join('\n')}\n`;
}

export function exportHarmonicityCsv(harmonicity: HarmonicityData): string {
  const rows = ['time,hnr_db'];
  for (let i = 0; i < harmonicity.times.length; i++) {
    const val = harmonicity.values[i] === -200 ? '' : harmonicity.values[i].toFixed(2);
    rows.push(`${harmonicity.times[i].toFixed(4)},${val}`);
  }
  return `${rows.join('\n')}\n`;
}

export function exportFormantCsv(formants: FormantData): string {
  const rows = ['time,f1_hz,f2_hz,f3_hz'];
  for (let i = 0; i < formants.times.length; i++) {
    rows.push(
      [
        formants.times[i],
        formants.f1[i] ?? '',
        formants.f2[i] ?? '',
        formants.f3[i] ?? '',
      ].join(',')
    );
  }
  return `${rows.join('\n')}\n`;
}

export function exportSelectedRegionWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/** Compute mean and standard deviation for an array of numbers (NaN/undefined filtered out). */
function stats(values: (number | undefined | null)[]): { mean: number; stdev: number; count: number } {
  const nums = values.filter((v): v is number => v != null && !isNaN(v));
  const count = nums.length;
  if (count === 0) return { mean: NaN, stdev: NaN, count: 0 };
  const mean = nums.reduce((a, b) => a + b, 0) / count;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
  return { mean, stdev: Math.sqrt(variance), count };
}

/** Get values from a time-series array within [start, end). */
function sliceByTime(times: number[] | Float64Array, values: (number | undefined | null)[], start: number, end: number): (number | undefined | null)[] {
  const result: (number | undefined | null)[] = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= start && times[i] < end) {
      result.push(values[i]);
    }
  }
  return result;
}

export interface IntervalStatsOptions {
  tier: IntervalTier;
  pitch?: PitchData;
  intensity?: IntensityData;
  formants?: FormantData;
  harmonicity?: HarmonicityData;
}

/**
 * Export per-interval statistics as CSV.
 * For each interval in the tier, computes mean/stdev of available analyses.
 */
export function exportIntervalStatsCsv(options: IntervalStatsOptions): string {
  const { tier, pitch, intensity, formants, harmonicity } = options;
  const headers = ['interval', 'label', 'start_s', 'end_s', 'duration_s'];
  if (pitch) headers.push('pitch_mean_hz', 'pitch_stdev_hz', 'pitch_n');
  if (intensity) headers.push('intensity_mean_db', 'intensity_stdev_db', 'intensity_n');
  if (formants) headers.push('f1_mean_hz', 'f1_stdev_hz', 'f2_mean_hz', 'f2_stdev_hz', 'f3_mean_hz', 'f3_stdev_hz', 'formant_n');
  if (harmonicity) headers.push('hnr_mean_db', 'hnr_stdev_db', 'hnr_n');

  const rows = [headers.join(',')];

  for (let idx = 0; idx < tier.intervals.length; idx++) {
    const interval = tier.intervals[idx];
    const { start, end, label } = interval;
    const duration = end - start;
    const row: string[] = [
      String(idx + 1),
      csvEscape(label),
      start.toFixed(4),
      end.toFixed(4),
      duration.toFixed(4),
    ];

    if (pitch) {
      const vals = sliceByTime(pitch.times, pitch.frequencies, start, end);
      const s = stats(vals);
      row.push(isNaN(s.mean) ? '' : s.mean.toFixed(2), isNaN(s.stdev) ? '' : s.stdev.toFixed(2), String(s.count));
    }
    if (intensity) {
      const vals = sliceByTime(intensity.times, intensity.values, start, end);
      const s = stats(vals);
      row.push(isNaN(s.mean) ? '' : s.mean.toFixed(2), isNaN(s.stdev) ? '' : s.stdev.toFixed(2), String(s.count));
    }
    if (formants) {
      const f1Vals = sliceByTime(formants.times, formants.f1, start, end);
      const f2Vals = sliceByTime(formants.times, formants.f2, start, end);
      const f3Vals = sliceByTime(formants.times, formants.f3, start, end);
      const s1 = stats(f1Vals);
      const s2 = stats(f2Vals);
      const s3 = stats(f3Vals);
      row.push(
        isNaN(s1.mean) ? '' : s1.mean.toFixed(2), isNaN(s1.stdev) ? '' : s1.stdev.toFixed(2),
        isNaN(s2.mean) ? '' : s2.mean.toFixed(2), isNaN(s2.stdev) ? '' : s2.stdev.toFixed(2),
        isNaN(s3.mean) ? '' : s3.mean.toFixed(2), isNaN(s3.stdev) ? '' : s3.stdev.toFixed(2),
        String(s1.count),
      );
    }
    if (harmonicity) {
      // Filter out -200 (unvoiced marker)
      const raw = sliceByTime(harmonicity.times, harmonicity.values, start, end);
      const filtered = raw.map(v => (v != null && v !== -200 ? v : undefined));
      const s = stats(filtered);
      row.push(isNaN(s.mean) ? '' : s.mean.toFixed(2), isNaN(s.stdev) ? '' : s.stdev.toFixed(2), String(s.count));
    }

    rows.push(row.join(','));
  }

  return `${rows.join('\n')}\n`;
}

export function downloadTextFile(filename: string, contents: string, type = 'text/plain'): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvEscape(filename);
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadBinaryFile(filename: string, contents: Uint8Array, type = 'audio/wav'): void {
  const arrayBuffer = new ArrayBuffer(contents.byteLength);
  new Uint8Array(arrayBuffer).set(contents);
  const blob = new Blob([arrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
