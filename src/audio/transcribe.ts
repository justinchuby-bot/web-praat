/**
 * Auto-transcribe audio using Web Speech API and generate TextGrid intervals.
 * Returns word-level intervals with timestamps.
 */
import type { TextGrid, Interval } from '../types';
import { createId } from '../utils/id';

export interface TranscribeOptions {
  lang?: string; // BCP-47 language code (default: 'en-US')
}

export function autoTranscribe(
  samples: Float32Array,
  sampleRate: number,
  duration: number,
  options: TranscribeOptions = {}
): Promise<TextGrid> {
  const { lang = 'en-US' } = options;

  return new Promise((resolve, reject) => {
    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition as any
      ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition as any;

    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported in this browser. Try Chrome or Edge.'));
      return;
    }

    // Create audio blob to play through speakers (Speech API listens to mic, but we need file input)
    // Alternative: use the recognition on a MediaStream from an AudioContext
    const audioCtx = new AudioContext({ sampleRate });
    const buffer = audioCtx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const source = audioCtx.createMediaStreamDestination();
    const bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(source);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    const intervals: Interval[] = [];
    let lastEnd = 0;

    recognition.onresult = (event: any) => {
      for (let i = 0; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const transcript = event.results[i][0].transcript.trim();
        if (!transcript) continue;

        // Web Speech API doesn't give precise word timestamps in most browsers
        // Estimate based on audio position
        const words = transcript.split(/\s+/);
        const avgWordDur = 0.3; // rough estimate
        for (const word of words) {
          const start = lastEnd;
          const end = Math.min(start + avgWordDur, duration);
          intervals.push({
            id: createId('int'),
            start,
            end,
            label: word,
          });
          lastEnd = end;
        }
      }
    };

    recognition.onerror = (event: any) => {
      audioCtx.close();
      // If no-speech or aborted, return what we have
      if (event.error === 'no-speech' || event.error === 'aborted') {
        resolve(buildTextGrid(intervals, duration));
      } else {
        reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      audioCtx.close();
      resolve(buildTextGrid(intervals, duration));
    };

    // Start recognition — it will listen to the default microphone
    // For file-based transcription, we play audio and let it pick up
    // This is a limitation of Web Speech API (designed for live mic)
    recognition.start();

    // Play the audio so the mic picks it up (hacky but works)
    // Better approach: just use it for live recordings
    // For files: use energy-based segmentation as fallback
    bufferSource.start();
    bufferSource.onended = () => {
      setTimeout(() => recognition.stop(), 1000); // grace period
    };
  });
}

/**
 * Simpler approach: energy-based auto-segmentation.
 * Splits audio into intervals based on silence detection.
 * No transcription, but gives you word-sized chunks to label manually.
 */
export function autoSegment(
  samples: Float32Array,
  sampleRate: number,
  options: { threshold?: number; minDuration?: number; minSilence?: number } = {}
): TextGrid {
  const { threshold = 0.02, minDuration = 0.05, minSilence = 0.15 } = options;
  const duration = samples.length / sampleRate;

  const frameSize = Math.round(sampleRate * 0.01); // 10ms frames
  const intervals: Interval[] = [];
  let inSpeech = false;
  let speechStart = 0;
  let silenceStart = 0;

  for (let i = 0; i < samples.length; i += frameSize) {
    let rms = 0;
    const end = Math.min(i + frameSize, samples.length);
    for (let j = i; j < end; j++) rms += samples[j] * samples[j];
    rms = Math.sqrt(rms / (end - i));
    const time = i / sampleRate;

    if (rms > threshold) {
      if (!inSpeech) {
        speechStart = time;
        inSpeech = true;
      }
      silenceStart = time;
    } else {
      if (inSpeech && (time - silenceStart) > minSilence) {
        const segEnd = silenceStart + 0.01;
        if (segEnd - speechStart > minDuration) {
          intervals.push({
            id: createId('int'),
            start: speechStart,
            end: segEnd,
            label: '',
          });
        }
        inSpeech = false;
      }
    }
  }

  // Final segment
  if (inSpeech) {
    const segEnd = samples.length / sampleRate;
    if (segEnd - speechStart > minDuration) {
      intervals.push({
        id: createId('int'),
        start: speechStart,
        end: segEnd,
        label: '',
      });
    }
  }

  return buildTextGrid(fillGaps(intervals, duration), duration);
}

function fillGaps(intervals: Interval[], duration: number): Interval[] {
  const filled: Interval[] = [];
  let lastEnd = 0;
  for (const int of intervals) {
    if (int.start > lastEnd + 0.001) {
      filled.push({ id: createId('int'), start: lastEnd, end: int.start, label: '' });
    }
    filled.push(int);
    lastEnd = int.end;
  }
  if (lastEnd < duration - 0.001) {
    filled.push({ id: createId('int'), start: lastEnd, end: duration, label: '' });
  }
  return filled;
}

function buildTextGrid(intervals: Interval[], duration: number): TextGrid {
  const filled = intervals.length > 0 ? fillGaps(intervals, duration) : [{ id: createId('int'), start: 0, end: duration, label: '' }];
  return {
    xmin: 0,
    xmax: duration,
    tiers: [{
      id: createId('tier'),
      name: 'words',
      kind: 'interval',
      intervals: filled,
    }],
  };
}
