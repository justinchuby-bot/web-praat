/**
 * SpeechSynthesizer — Web Speech API integration for TTS.
 *
 * Mirrors Praat's SpeechSynthesizer object:
 * - Language/voice selection
 * - Rate, pitch, volume controls
 * - Text-to-Sound conversion (captures audio via MediaStream)
 * - Phoneme output (where supported)
 */

export interface SpeechSynthesizerSettings {
  language: string; // BCP-47 language tag, e.g. "en-US"
  voiceName: string;
  rate: number; // 0.1–10, default 1
  pitch: number; // 0–2, default 1
  volume: number; // 0–1, default 1
}

export const DEFAULT_SETTINGS: SpeechSynthesizerSettings = {
  language: 'en-US',
  voiceName: '',
  rate: 1,
  pitch: 1,
  volume: 1,
};

export interface SynthesisResult {
  /** Duration in seconds (estimated from utterance events) */
  duration: number;
  /** Word boundaries if available */
  wordBoundaries: Array<{ word: string; charIndex: number; time: number }>;
}

/**
 * Get available voices, grouped by language.
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Get voices grouped by language code.
 */
export function getVoicesByLanguage(): Map<string, SpeechSynthesisVoice[]> {
  const voices = getAvailableVoices();
  const map = new Map<string, SpeechSynthesisVoice[]>();
  for (const v of voices) {
    const lang = v.lang;
    if (!map.has(lang)) map.set(lang, []);
    map.get(lang)!.push(v);
  }
  return map;
}

/**
 * Check if Web Speech API is available.
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak text with given settings. Returns a promise that resolves when done.
 */
export function speak(
  text: string,
  settings: Partial<SpeechSynthesizerSettings> = {},
): Promise<SynthesisResult> {
  const opts = { ...DEFAULT_SETTINGS, ...settings };

  return new Promise((resolve, reject) => {
    if (!isSpeechSynthesisSupported()) {
      reject(new Error('Web Speech API is not supported in this browser'));
      return;
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = opts.language;
    utterance.rate = opts.rate;
    utterance.pitch = opts.pitch;
    utterance.volume = opts.volume;

    // Find matching voice
    if (opts.voiceName) {
      const voices = synth.getVoices();
      const match = voices.find(
        (v) => v.name === opts.voiceName || v.voiceURI === opts.voiceName,
      );
      if (match) utterance.voice = match;
    }

    const startTime = performance.now();
    const wordBoundaries: SynthesisResult['wordBoundaries'] = [];

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const time = (performance.now() - startTime) / 1000;
        const word = text.substring(
          event.charIndex,
          event.charIndex + (event.charLength || 1),
        );
        wordBoundaries.push({ word, charIndex: event.charIndex, time });
      }
    };

    utterance.onend = () => {
      const duration = (performance.now() - startTime) / 1000;
      resolve({ duration, wordBoundaries });
    };

    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        const duration = (performance.now() - startTime) / 1000;
        resolve({ duration, wordBoundaries });
      } else {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      }
    };

    synth.speak(utterance);
  });
}

/**
 * Stop any ongoing speech.
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Pause speech.
 */
export function pauseSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume paused speech.
 */
export function resumeSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.resume();
  }
}

/**
 * Check if currently speaking.
 */
export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return window.speechSynthesis.speaking;
}
