import { describe, it, expect } from 'vitest';
import {
  generateTrialOrder,
  exportResultsToCSV,
  type ExperimentConfig,
  type ExperimentResults,
  type TrialResult,
} from '../src/audio/experiment';

const baseConfig: ExperimentConfig = {
  options: ['ba', 'pa'],
  stimuli: ['s1.wav', 's2.wav', 's3.wav'],
  repetitions: 4,
  randomize: false,
  isi: 500,
};

describe('generateTrialOrder', () => {
  it('produces correct total count (stimuli × repetitions)', () => {
    const order = generateTrialOrder(baseConfig);
    expect(order.length).toBe(3 * 4);
  });

  it('each stimulus appears exactly repetitions times', () => {
    const order = generateTrialOrder({ ...baseConfig, randomize: true });
    const counts: Record<string, number> = {};
    for (const s of order) {
      counts[s] = (counts[s] || 0) + 1;
    }
    expect(counts['s1.wav']).toBe(4);
    expect(counts['s2.wav']).toBe(4);
    expect(counts['s3.wav']).toBe(4);
  });

  it('non-randomized order is sequential', () => {
    const order = generateTrialOrder(baseConfig);
    // First 3 should be s1, s2, s3
    expect(order[0]).toBe('s1.wav');
    expect(order[1]).toBe('s2.wav');
    expect(order[2]).toBe('s3.wav');
  });

  it('randomized order is not always identical to sequential (probabilistic)', () => {
    // Run multiple times; at least one should differ
    let diffFound = false;
    const sequential = generateTrialOrder({ ...baseConfig, randomize: false });
    for (let i = 0; i < 20; i++) {
      const randomized = generateTrialOrder({ ...baseConfig, randomize: true });
      if (randomized.join(',') !== sequential.join(',')) {
        diffFound = true;
        break;
      }
    }
    expect(diffFound).toBe(true);
  });
});

describe('exportResultsToCSV', () => {
  it('produces correct header and rows', () => {
    const trials: TrialResult[] = [
      { trialIndex: 0, stimulus: 's1.wav', response: 'ba', reactionTime: 320 },
      { trialIndex: 1, stimulus: 's2.wav', response: 'pa', reactionTime: 450 },
    ];
    const results: ExperimentResults = {
      config: baseConfig,
      trials,
      startTime: 1000,
      endTime: 5000,
    };
    const csv = exportResultsToCSV(results);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('trial,stimulus,response,reactionTime_ms');
    expect(lines[1]).toBe('0,s1.wav,ba,320');
    expect(lines[2]).toBe('1,s2.wav,pa,450');
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it('handles empty results', () => {
    const results: ExperimentResults = {
      config: baseConfig,
      trials: [],
      startTime: 0,
      endTime: 0,
    };
    const csv = exportResultsToCSV(results);
    expect(csv).toBe('trial,stimulus,response,reactionTime_ms');
  });
});
