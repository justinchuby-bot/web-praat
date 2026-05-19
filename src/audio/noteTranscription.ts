/**
 * Note transcription — convert pitch (F0) track to musical notes/semitones.
 *
 * Features:
 * - Hz → MIDI number (fractional)
 * - Hz → note name + octave + cents deviation
 * - Pitch track → sequence of notes with onset/offset times
 * - Quantization to nearest semitone
 */

import type { PitchData } from '../types';

export interface NoteInfo {
  midi: number;         // MIDI note number (fractional for cents)
  midiRounded: number;  // Nearest integer MIDI
  name: string;         // e.g. "A4", "C#5"
  cents: number;        // Deviation from nearest semitone (-50 to +50)
  frequency: number;    // Original Hz
}

export interface NoteEvent {
  startTime: number;    // seconds
  endTime: number;      // seconds
  note: NoteInfo;
}

export interface TranscriptionOptions {
  /** Reference frequency for A4 (default 440 Hz) */
  referenceA4?: number;
  /** Minimum note duration in seconds to avoid flicker (default 0.05) */
  minDuration?: number;
  /** Maximum cents deviation to merge adjacent same-note segments (default 50) */
  mergeCentsThreshold?: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert frequency (Hz) to MIDI note number (fractional).
 * A4 = 440 Hz = MIDI 69
 */
export function hzToMidi(hz: number, referenceA4 = 440): number {
  if (hz <= 0) return 0;
  return 69 + 12 * Math.log2(hz / referenceA4);
}

/**
 * Convert MIDI note number to frequency (Hz).
 */
export function midiToHz(midi: number, referenceA4 = 440): number {
  return referenceA4 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert frequency to semitones relative to reference (default A4=440).
 */
export function hzToSemitones(hz: number, referenceHz = 440): number {
  if (hz <= 0) return 0;
  return 12 * Math.log2(hz / referenceHz);
}

/**
 * Get note info from a frequency.
 */
export function frequencyToNote(hz: number, referenceA4 = 440): NoteInfo {
  if (hz <= 0) {
    return { midi: 0, midiRounded: 0, name: '—', cents: 0, frequency: hz };
  }

  const midi = hzToMidi(hz, referenceA4);
  const midiRounded = Math.round(midi);
  const cents = Math.round((midi - midiRounded) * 100);

  const noteIndex = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  const name = `${NOTE_NAMES[noteIndex]}${octave}`;

  return { midi, midiRounded, name, cents, frequency: hz };
}

/**
 * Transcribe a pitch track into a sequence of note events.
 * Merges consecutive frames with the same note into events.
 */
export function transcribePitch(pitch: PitchData, options: TranscriptionOptions = {}): NoteEvent[] {
  const {
    referenceA4 = 440,
    minDuration = 0.05,
    mergeCentsThreshold = 50,
  } = options;

  const events: NoteEvent[] = [];
  const { times, frequencies } = pitch;

  let currentNote: number | null = null;
  let segStart = 0;
  let segFreqs: number[] = [];

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    const hz = frequencies[i];

    // Skip unvoiced frames
    if (hz == null || hz <= 0) {
      if (currentNote !== null && segFreqs.length > 0) {
        const endTime = time;
        if (endTime - segStart >= minDuration) {
          const avgHz = segFreqs.reduce((a, b) => a + b, 0) / segFreqs.length;
          events.push({ startTime: segStart, endTime, note: frequencyToNote(avgHz, referenceA4) });
        }
      }
      currentNote = null;
      segFreqs = [];
      continue;
    }

    const midi = Math.round(hzToMidi(hz, referenceA4));

    if (currentNote === null) {
      currentNote = midi;
      segStart = time;
      segFreqs = [hz];
    } else if (midi === currentNote || Math.abs(hzToMidi(hz, referenceA4) - currentNote) * 100 < mergeCentsThreshold) {
      segFreqs.push(hz);
    } else {
      const endTime = time;
      if (endTime - segStart >= minDuration) {
        const avgHz = segFreqs.reduce((a, b) => a + b, 0) / segFreqs.length;
        events.push({ startTime: segStart, endTime, note: frequencyToNote(avgHz, referenceA4) });
      }
      currentNote = midi;
      segStart = time;
      segFreqs = [hz];
    }
  }

  // Flush final segment
  if (currentNote !== null && segFreqs.length > 0) {
    const endTime = times[times.length - 1];
    if (endTime - segStart >= minDuration) {
      const avgHz = segFreqs.reduce((a, b) => a + b, 0) / segFreqs.length;
      events.push({ startTime: segStart, endTime, note: frequencyToNote(avgHz, referenceA4) });
    }
  }

  return events;
}

/**
 * Format note events as a simple text transcription.
 */
export function formatTranscription(events: NoteEvent[]): string {
  return events
    .map(e => `${e.startTime.toFixed(3)}–${e.endTime.toFixed(3)}s: ${e.note.name} (${e.note.cents >= 0 ? '+' : ''}${e.note.cents}¢) [${e.note.frequency.toFixed(1)} Hz]`)
    .join('\n');
}
