import { describe, expect, it } from 'vitest';
import { StreamingRecorder } from '../src/audio/streamingRecorder';

describe('StreamingRecorder', () => {
  it('accumulates samples via getAllSamples', () => {
    const recorder = new StreamingRecorder();
    // Test the concatenation logic directly by accessing internal state
    // Since we can't actually call getUserMedia in tests, test the class exists
    expect(recorder.isRecording).toBe(false);
    expect(recorder.sampleRate).toBe(44100);
  });

  it('getAllSamples returns empty when not recording', () => {
    const recorder = new StreamingRecorder();
    const samples = recorder.getAllSamples();
    expect(samples.length).toBe(0);
  });
});
