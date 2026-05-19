/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isSpeechSynthesisSupported,
  getAvailableVoices,
  getVoicesByLanguage,
  speak,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  isSpeaking,
} from '../src/audio/speechSynthesizer';

describe('speechSynthesizer', () => {
  beforeEach(() => {
    // Mock Web Speech API
    const mockVoices = [
      { name: 'Google US English', lang: 'en-US', default: true, voiceURI: 'google-us', localService: true },
      { name: 'Google UK English', lang: 'en-GB', default: false, voiceURI: 'google-uk', localService: true },
      { name: 'Google Deutsch', lang: 'de-DE', default: false, voiceURI: 'google-de', localService: false },
    ] as SpeechSynthesisVoice[];

    const mockSynth = {
      getVoices: () => mockVoices,
      speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
        // Simulate immediate end
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend(new Event('end') as SpeechSynthesisEvent);
          }
        }, 10);
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speaking: false,
      onvoiceschanged: null,
    };

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSynth,
      writable: true,
      configurable: true,
    });

    // Mock SpeechSynthesisUtterance
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      onboundary: ((ev: Event) => void) | null = null;
      constructor(text: string) { this.text = text; }
    });
  });

  it('should have correct default settings', () => {
    expect(DEFAULT_SETTINGS.rate).toBe(1);
    expect(DEFAULT_SETTINGS.pitch).toBe(1);
    expect(DEFAULT_SETTINGS.volume).toBe(1);
    expect(DEFAULT_SETTINGS.language).toBe('en-US');
  });

  it('should detect speech synthesis support', () => {
    expect(isSpeechSynthesisSupported()).toBe(true);
  });

  it('should get available voices', () => {
    const voices = getAvailableVoices();
    expect(voices).toHaveLength(3);
    expect(voices[0].name).toBe('Google US English');
  });

  it('should group voices by language', () => {
    const map = getVoicesByLanguage();
    expect(map.has('en-US')).toBe(true);
    expect(map.has('en-GB')).toBe(true);
    expect(map.has('de-DE')).toBe(true);
    expect(map.get('en-US')).toHaveLength(1);
  });

  it('should speak text and return result', async () => {
    const result = await speak('Hello world');
    expect(result).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.wordBoundaries).toBeInstanceOf(Array);
  });

  it('should stop speaking', () => {
    stopSpeaking();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('should pause speaking', () => {
    pauseSpeaking();
    expect(window.speechSynthesis.pause).toHaveBeenCalled();
  });

  it('should resume speaking', () => {
    resumeSpeaking();
    expect(window.speechSynthesis.resume).toHaveBeenCalled();
  });

  it('should report speaking state', () => {
    expect(isSpeaking()).toBe(false);
  });

  it('should apply voice by name', async () => {
    const result = await speak('Test', { voiceName: 'Google UK English' });
    expect(result).toBeDefined();
  });
});
