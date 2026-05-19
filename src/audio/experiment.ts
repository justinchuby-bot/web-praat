/**
 * ExperimentMFC — Perception experiment logic
 */

export interface ExperimentConfig {
  /** Labels for response options (e.g. ["ba", "pa"]) */
  options: string[];
  /** Audio stimuli as File objects or URLs */
  stimuli: string[];
  /** Number of repetitions per stimulus */
  repetitions: number;
  /** Whether to randomize trial order */
  randomize: boolean;
  /** Inter-stimulus interval in ms */
  isi: number;
}

export interface TrialResult {
  trialIndex: number;
  stimulus: string;
  response: string;
  reactionTime: number; // ms from stimulus onset to response
}

export interface ExperimentResults {
  config: ExperimentConfig;
  trials: TrialResult[];
  startTime: number;
  endTime: number;
}

/**
 * Generate the trial order based on config.
 * Each stimulus appears `repetitions` times, optionally randomized.
 */
export function generateTrialOrder(config: ExperimentConfig): string[] {
  const trials: string[] = [];
  for (let r = 0; r < config.repetitions; r++) {
    for (const s of config.stimuli) {
      trials.push(s);
    }
  }
  if (config.randomize) {
    // Fisher-Yates shuffle
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }
  }
  return trials;
}

/**
 * Export results to CSV string.
 */
export function exportResultsToCSV(results: ExperimentResults): string {
  const header = 'trial,stimulus,response,reactionTime_ms';
  const rows = results.trials.map(
    (t) => `${t.trialIndex},${t.stimulus},${t.response},${t.reactionTime}`
  );
  return [header, ...rows].join('\n');
}
