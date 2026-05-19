import { describe, it, expect } from 'vitest';
import {
  hzToMidi,
  midiToHz,
  hzToSemitones,
  frequencyToNote,
  transcribePitch,
  formatTranscription,
} from '../src/audio/noteTranscription';
import type { PitchData } from '../src/types';

describe('noteTranscription', () => {
  describe('hzToMidi', () => {
    it('converts A4 (440 Hz) to MIDI 69', () => {
      expect(hzToMidi(440)).toBeCloseTo(69, 5);
    });

    it('converts C4 (261.63 Hz) to MIDI 60', () => {
      expect(hzToMidi(261.63)).toBeCloseTo(60, 0);
    });

    it('converts A3 (220 Hz) to MIDI 57', () => {
      expect(hzToMidi(220)).toBeCloseTo(57, 5);
    });

    it('returns 0 for invalid frequency', () => {
      expect(hzToMidi(0)).toBe(0);
      expect(hzToMidi(-1)).toBe(0);
    });

    it('respects custom reference A4', () => {
      expect(hzToMidi(442, 442)).toBeCloseTo(69, 5);
    });
  });

  describe('midiToHz', () => {
    it('converts MIDI 69 to 440 Hz', () => {
      expect(midiToHz(69)).toBeCloseTo(440, 2);
    });

    it('converts MIDI 60 to ~261.63 Hz', () => {
      expect(midiToHz(60)).toBeCloseTo(261.63, 1);
    });

    it('is inverse of hzToMidi', () => {
      expect(midiToHz(hzToMidi(330))).toBeCloseTo(330, 5);
    });
  });

  describe('hzToSemitones', () => {
    it('returns 0 for reference frequency', () => {
      expect(hzToSemitones(440, 440)).toBe(0);
    });

    it('returns 12 for one octave up', () => {
      expect(hzToSemitones(880, 440)).toBeCloseTo(12, 5);
    });

    it('returns -12 for one octave down', () => {
      expect(hzToSemitones(220, 440)).toBeCloseTo(-12, 5);
    });
  });

  describe('frequencyToNote', () => {
    it('identifies A4 correctly', () => {
      const note = frequencyToNote(440);
      expect(note.name).toBe('A4');
      expect(note.midiRounded).toBe(69);
      expect(note.cents).toBe(0);
    });

    it('identifies C4 with small cents deviation', () => {
      const note = frequencyToNote(261.63);
      expect(note.name).toBe('C4');
      expect(note.midiRounded).toBe(60);
      expect(Math.abs(note.cents)).toBeLessThan(5);
    });

    it('shows cents deviation for off-pitch notes', () => {
      const note = frequencyToNote(445);
      expect(note.name).toBe('A4');
      expect(note.cents).toBeGreaterThan(0);
    });

    it('handles zero/negative frequency', () => {
      const note = frequencyToNote(0);
      expect(note.name).toBe('—');
    });
  });

  describe('transcribePitch', () => {
    function makePitch(frequencies: (number | null)[], dt = 0.01): PitchData {
      return {
        times: frequencies.map((_, i) => i * dt),
        frequencies,
      };
    }

    it('transcribes a steady A4 as a single event', () => {
      const pitch = makePitch(Array(20).fill(440)); // 200ms of A4
      const events = transcribePitch(pitch);
      expect(events.length).toBe(1);
      expect(events[0].note.name).toBe('A4');
    });

    it('splits at note changes', () => {
      const freqs: (number | null)[] = [...Array(10).fill(440), ...Array(10).fill(493.88)];
      const pitch = makePitch(freqs);
      const events = transcribePitch(pitch);
      expect(events.length).toBe(2);
      expect(events[0].note.name).toBe('A4');
      expect(events[1].note.name).toBe('B4');
    });

    it('skips unvoiced segments', () => {
      const freqs: (number | null)[] = [...Array(10).fill(440), ...Array(5).fill(null), ...Array(10).fill(440)];
      const pitch = makePitch(freqs);
      const events = transcribePitch(pitch);
      expect(events.length).toBe(2);
    });

    it('respects minDuration filter', () => {
      const pitch = makePitch(Array(3).fill(440)); // 30ms < 50ms threshold
      const events = transcribePitch(pitch);
      expect(events.length).toBe(0);
    });
  });

  describe('formatTranscription', () => {
    it('formats events as readable text', () => {
      const events = [{
        startTime: 0,
        endTime: 0.5,
        note: { midi: 69, midiRounded: 69, name: 'A4', cents: 0, frequency: 440 },
      }];
      const text = formatTranscription(events);
      expect(text).toContain('A4');
      expect(text).toContain('440.0 Hz');
      expect(text).toContain('0.000–0.500s');
    });
  });
});
