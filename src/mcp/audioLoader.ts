/**
 * Audio loader — loads WAV files from path or base64 data.
 */
import * as fs from 'node:fs';

export interface AudioData {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
}

/**
 * Load audio from a file path or base64 string.
 * Supports WAV format (PCM 16-bit or 32-bit float).
 */
export function loadAudio(input: { filePath?: string; base64?: string }): AudioData {
  let buffer: Buffer;

  if (input.filePath) {
    buffer = fs.readFileSync(input.filePath);
  } else if (input.base64) {
    buffer = Buffer.from(input.base64, 'base64');
  } else {
    throw new Error('Either filePath or base64 must be provided');
  }

  return decodeWav(buffer);
}

function decodeWav(buffer: Buffer): AudioData {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Verify RIFF header
  const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
  if (riff !== 'RIFF') throw new Error('Not a valid WAV file: missing RIFF header');

  const wave = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  if (wave !== 'WAVE') throw new Error('Not a valid WAV file: missing WAVE format');

  // Find fmt chunk
  let offset = 12;
  let fmtOffset = -1;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset < buffer.length - 8) {
    const chunkId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      fmtOffset = offset + 8;
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
    // Word-align
    if (offset % 2 !== 0) offset++;
  }

  if (fmtOffset === -1) throw new Error('WAV file missing fmt chunk');
  if (dataOffset === -1) throw new Error('WAV file missing data chunk');

  const audioFormat = view.getUint16(fmtOffset, true);
  const channels = view.getUint16(fmtOffset + 2, true);
  const sampleRate = view.getUint32(fmtOffset + 4, true);
  const bitsPerSample = view.getUint16(fmtOffset + 14, true);

  let samples: Float32Array;

  if (audioFormat === 1) {
    // PCM
    if (bitsPerSample === 16) {
      const numSamples = dataSize / 2;
      samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
      }
    } else if (bitsPerSample === 24) {
      const numSamples = dataSize / 3;
      samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const b0 = buffer[dataOffset + i * 3];
        const b1 = buffer[dataOffset + i * 3 + 1];
        const b2 = buffer[dataOffset + i * 3 + 2];
        const val = (b0 | (b1 << 8) | (b2 << 16)) - ((b2 & 0x80) ? 0x1000000 : 0);
        samples[i] = val / 8388608;
      }
    } else if (bitsPerSample === 32) {
      const numSamples = dataSize / 4;
      samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = view.getInt32(dataOffset + i * 4, true) / 2147483648;
      }
    } else {
      throw new Error(`Unsupported PCM bit depth: ${bitsPerSample}`);
    }
  } else if (audioFormat === 3) {
    // IEEE float
    if (bitsPerSample === 32) {
      const numSamples = dataSize / 4;
      samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = view.getFloat32(dataOffset + i * 4, true);
      }
    } else if (bitsPerSample === 64) {
      const numSamples = dataSize / 8;
      samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = view.getFloat64(dataOffset + i * 8, true);
      }
    } else {
      throw new Error(`Unsupported float bit depth: ${bitsPerSample}`);
    }
  } else {
    throw new Error(`Unsupported audio format: ${audioFormat}`);
  }

  // Mix down to mono if multi-channel
  if (channels > 1) {
    const monoSamples = new Float32Array(samples.length / channels);
    for (let i = 0; i < monoSamples.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        sum += samples[i * channels + ch];
      }
      monoSamples[i] = sum / channels;
    }
    return { samples: monoSamples, sampleRate, channels };
  }

  return { samples, sampleRate, channels };
}
