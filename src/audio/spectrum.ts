import { hammingWindow, fftMagnitude } from '../utils/fft';
import { burgMethod } from './lpc';
import type { AnalysisSettings, SpectrumSliceData } from '../types';

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, value)));
}

function getFrame(samples: Float32Array, centerIndex: number, frameSize: number): Float64Array {
  const start = centerIndex - Math.floor(frameSize / 2);
  const frame = new Float64Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    const index = start + i;
    frame[i] = index >= 0 && index < samples.length ? samples[index] : 0;
  }
  return frame;
}

function evaluateLpcEnvelope(
  coefficients: Float64Array,
  bins: number
): Float64Array {
  const envelope = new Float64Array(bins);
  for (let i = 0; i < bins; i++) {
    const omega = (Math.PI * i) / Math.max(bins - 1, 1);
    let real = 1;
    let imag = 0;
    for (let k = 1; k < coefficients.length; k++) {
      real -= coefficients[k] * Math.cos(omega * k);
      imag += coefficients[k] * Math.sin(omega * k);
    }
    const magnitude = 1 / Math.max(Math.hypot(real, imag), 1e-8);
    envelope[i] = 20 * Math.log10(magnitude);
  }
  return envelope;
}

export function computeSpectrumSlice(
  samples: Float32Array,
  sampleRate: number,
  time: number,
  settings: AnalysisSettings
): SpectrumSliceData {
  const centerIndex = Math.round(time * sampleRate);
  const frameSize = settings.spectrogram.fftSize;
  const fftSize = nextPowerOfTwo(frameSize);
  const frame = hammingWindow(getFrame(samples, centerIndex, frameSize));
  const fftMagnitudes = fftMagnitude(frame, fftSize);
  const fftFrequencies = new Float64Array(fftMagnitudes.length);
  for (let i = 0; i < fftFrequencies.length; i++) {
    fftFrequencies[i] = (i * sampleRate) / fftSize;
  }

  const centeredFrame = getFrame(samples, centerIndex, Math.max(frameSize, 256));
  let mean = 0;
  for (let i = 0; i < centeredFrame.length; i++) mean += centeredFrame[i];
  mean /= centeredFrame.length;
  for (let i = 0; i < centeredFrame.length; i++) centeredFrame[i] -= mean;
  const coefficients = burgMethod(centeredFrame, settings.formant.lpcOrder);
  const lpcEnvelope = evaluateLpcEnvelope(coefficients, fftMagnitudes.length);

  return {
    time,
    fftFrequencies,
    fftMagnitudes,
    lpcEnvelope,
  };
}
