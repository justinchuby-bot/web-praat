import { serializeTextGrid } from '../textgrid/parser';
import type { FormantData, HarmonicityData, IntensityData, PitchData, TextGrid } from '../types';

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
