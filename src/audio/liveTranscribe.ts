/**
 * Live Transcribe — records audio while using Web Speech API to
 * generate word-level TextGrid annotations in real-time.
 */
import type { TextGrid, Interval } from '../types';
import { createId } from '../utils/id';

export interface LiveTranscribeResult {
  samples: Float32Array;
  sampleRate: number;
  textGrid: TextGrid;
}

export interface LiveTranscribeCallbacks {
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string, intervals: Interval[]) => void;
}

export class LiveTranscriber {
  private recognition: any = null;
  private audioContext: AudioContext | null = null;
  private chunks: Float32Array[] = [];
  private intervals: Interval[] = [];
  private startTime = 0;
  private lastWordEnd = 0;
  private _isRunning = false;
  private lang: string;

  constructor(lang = 'en-US') {
    this.lang = lang;
  }

  get isRunning(): boolean { return this._isRunning; }
  get currentIntervals(): Interval[] { return [...this.intervals]; }

  async start(callbacks?: LiveTranscribeCallbacks): Promise<void> {
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported. Use Chrome or Edge.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);

    // Capture raw samples via ScriptProcessor
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!this._isRunning) return;
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(this.audioContext.destination);

    // Speech recognition
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (!text) continue;
          const now = (Date.now() - this.startTime) / 1000;
          const words = text.split(/\s+/);
          const wordDur = Math.max(0.1, (now - this.lastWordEnd) / words.length);

          for (const word of words) {
            const start = this.lastWordEnd;
            const end = start + wordDur;
            this.intervals.push({
              id: createId('int'),
              start,
              end,
              label: word,
            });
            this.lastWordEnd = end;
          }
          callbacks?.onFinalResult?.(text, this.intervals);
        } else {
          callbacks?.onInterimResult?.(result[0].transcript);
        }
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if still running (Speech API has ~60s timeout)
      if (this._isRunning) {
        try { this.recognition.start(); } catch { /* ignore */ }
      }
    };

    this.startTime = Date.now();
    this.lastWordEnd = 0;
    this.intervals = [];
    this.chunks = [];
    this._isRunning = true;
    this.recognition.start();
  }

  stop(): LiveTranscribeResult {
    this._isRunning = false;
    this.recognition?.stop();
    this.audioContext?.close();

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const samples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const duration = samples.length / sampleRate;
    const textGrid = this.buildTextGrid(duration);

    this.audioContext = null;
    this.recognition = null;

    return { samples, sampleRate, textGrid };
  }

  private buildTextGrid(duration: number): TextGrid {
    // Fill gaps with empty intervals
    const filled: Interval[] = [];
    let lastEnd = 0;
    for (const int of this.intervals) {
      if (int.start > lastEnd + 0.001) {
        filled.push({ id: createId('int'), start: lastEnd, end: int.start, label: '' });
      }
      filled.push(int);
      lastEnd = int.end;
    }
    if (lastEnd < duration - 0.001) {
      filled.push({ id: createId('int'), start: lastEnd, end: duration, label: '' });
    }
    if (filled.length === 0) {
      filled.push({ id: createId('int'), start: 0, end: duration, label: '' });
    }

    return {
      xmin: 0,
      xmax: duration,
      tiers: [{
        id: createId('tier'),
        name: 'transcription',
        kind: 'interval',
        intervals: filled,
      }],
    };
  }
}
