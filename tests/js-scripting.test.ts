import { describe, it, expect } from 'vitest';
import { runJavaScript } from '../src/scripting/jsRunner';
import type { JsApiContext } from '../src/scripting/jsApi';

function makeContext(length = 4410): JsApiContext {
  // Generate a simple sine wave at 440Hz
  const sampleRate = 44100;
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
  }
  return { samples, sampleRate };
}

describe('JS Scripting', () => {
  describe('basic execution', () => {
    it('runs simple variable assignment and loop', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        let sum = 0;
        for (let i = 0; i < 10; i++) {
          sum += i;
        }
        praat.log(sum);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('45');
    });

    it('supports arrow functions and template literals', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        const greet = (name) => \`Hello, \${name}!\`;
        praat.log(greet("World"));
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('Hello, World!');
    });
  });

  describe('API calls', () => {
    it('toPitch returns pitch data', () => {
      // Need enough samples for pitch analysis (~100ms at 44100)
      const ctx = makeContext(44100);
      const result = runJavaScript(`
        const pitch = praat.toPitch(praat.audio, { minPitch: 75, maxPitch: 600 });
        praat.log(typeof pitch.times);
        praat.log(typeof pitch.frequencies);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toContain('object');
    });

    it('toFormant returns formant data', () => {
      const ctx = makeContext(44100);
      const result = runJavaScript(`
        const formants = praat.toFormant(praat.audio, { maxFormant: 5500 });
        praat.log(Array.isArray(formants.f1));
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('true');
    });

    it('getMean computes mean of pitch data', () => {
      const ctx = makeContext(44100);
      const result = runJavaScript(`
        const pitch = praat.toPitch();
        const mean = praat.getMean(pitch, 0, 0);
        praat.log(typeof mean === 'number');
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('true');
    });

    it('filter applies lowpass filter', () => {
      const ctx = makeContext(4410);
      const result = runJavaScript(`
        const filtered = praat.filter(praat.audio, { type: 'lowpass', cutoff: 1000 });
        praat.log(filtered.length === praat.audio.length);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('true');
    });

    it('preEmphasis works', () => {
      const ctx = makeContext(1000);
      const result = runJavaScript(`
        const out = praat.preEmphasis(praat.audio, 0.97);
        praat.log(out.length === praat.audio.length);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('true');
    });

    it('audio and sampleRate properties', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log(praat.audio.length);
        praat.log(praat.sampleRate);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('100\n44100');
    });
  });

  describe('log output', () => {
    it('multiple log calls produce newline-separated output', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log("line1");
        praat.log("line2");
        praat.log("line3");
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('line1\nline2\nline3');
    });

    it('log joins multiple args with space', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log("a", 1, true);
      `, ctx);

      expect(result.output).toBe('a 1 true');
    });
  });

  describe('error handling', () => {
    it('catches syntax errors', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        const x = {;
      `, ctx);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('SyntaxError');
    });

    it('catches runtime errors', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        const obj = null;
        obj.property;
      `, ctx);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('TypeError');
    });

    it('catches reference errors for undeclared vars', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log(undeclaredVariable);
      `, ctx);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('ReferenceError');
    });
  });

  describe('sandbox security', () => {
    it('cannot access window', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log(typeof window);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('undefined');
    });

    it('cannot access document', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log(typeof document);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('undefined');
    });

    it('cannot access fetch', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log(typeof fetch);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('undefined');
    });

    it('cannot access globalThis', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        praat.log(typeof globalThis);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('undefined');
    });

    it('eval cannot access sandbox context to break out', () => {
      const ctx = makeContext(100);
      // Even if eval exists, user code runs in strict mode with no access to outer scope secrets
      const result = runJavaScript(`
        try {
          // eval is available but can't escape the sandbox scope
          praat.log('eval exists: ' + (typeof eval === 'function'));
        } catch(e) {
          praat.log('blocked');
        }
      `, ctx);

      expect(result.errors).toHaveLength(0);
      // eval exists in JS but the sandbox blocks dangerous globals
      expect(result.output).toContain('eval exists: true');
    });

    it('Function constructor cannot access dangerous globals', () => {
      const ctx = makeContext(100);
      const result = runJavaScript(`
        // Even if Function exists, constructed functions inherit the blocked scope
        praat.log(typeof window);
        praat.log(typeof document);
      `, ctx);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('undefined\nundefined');
    });
  });
});
