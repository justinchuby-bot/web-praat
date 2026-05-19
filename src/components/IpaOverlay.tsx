import React, { useMemo } from 'react';
import { findClosestVowel } from '../audio/ipaMapper';

export interface FormantFrame {
  time: number;
  f1: number | null;
  f2: number | null;
}

export interface IpaOverlayProps {
  /** Formant data frames */
  frames: FormantFrame[];
  /** View range in seconds */
  viewStart: number;
  viewEnd: number;
  /** Canvas/container width in pixels */
  width: number;
  /** Canvas/container height in pixels */
  height: number;
  /** Maximum frequency displayed (for y-axis mapping) */
  maxFreq: number;
  /** Distance threshold — only show IPA when distance < this value (Bark) */
  distanceThreshold?: number;
  /** Minimum stable segment duration in ms */
  minStableMs?: number;
}

interface StableSegment {
  startIdx: number;
  endIdx: number;
  avgF1: number;
  avgF2: number;
  midTime: number;
}

/**
 * Detect stable formant segments (regions where F1/F2 vary little over > minMs).
 */
function detectStableSegments(
  frames: FormantFrame[],
  minMs: number,
  maxF1Var: number = 50,
  maxF2Var: number = 100
): StableSegment[] {
  const segments: StableSegment[] = [];
  let segStart = 0;

  for (let i = 1; i <= frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];

    const breakSegment =
      !curr ||
      curr.f1 === null ||
      curr.f2 === null ||
      prev.f1 === null ||
      prev.f2 === null ||
      Math.abs(curr.f1! - prev.f1!) > maxF1Var ||
      Math.abs(curr.f2! - prev.f2!) > maxF2Var;

    if (breakSegment) {
      // Check if segment is long enough
      const segFrames = frames.slice(segStart, i);
      const voiced = segFrames.filter((f) => f.f1 !== null && f.f2 !== null);
      if (voiced.length >= 2) {
        const duration = (voiced[voiced.length - 1].time - voiced[0].time) * 1000;
        if (duration >= minMs) {
          const avgF1 = voiced.reduce((s, f) => s + f.f1!, 0) / voiced.length;
          const avgF2 = voiced.reduce((s, f) => s + f.f2!, 0) / voiced.length;
          const midTime = (voiced[0].time + voiced[voiced.length - 1].time) / 2;
          segments.push({ startIdx: segStart, endIdx: i - 1, avgF1, avgF2, midTime });
        }
      }
      segStart = i;
    }
  }

  return segments;
}

/**
 * IPA overlay component that renders IPA vowel symbols on stable formant segments.
 * Positioned absolutely over the spectrogram/waveform display.
 */
export const IpaOverlay: React.FC<IpaOverlayProps> = ({
  frames,
  viewStart,
  viewEnd,
  width,
  height,
  maxFreq,
  distanceThreshold = 2.5,
  minStableMs = 50,
}) => {
  const annotations = useMemo(() => {
    const segments = detectStableSegments(frames, minStableMs);
    return segments
      .map((seg) => {
        const { ipa, distance } = findClosestVowel(seg.avgF1, seg.avgF2);
        return { ...seg, ipa, distance };
      })
      .filter((a) => a.distance < distanceThreshold);
  }, [frames, minStableMs, distanceThreshold]);

  const viewDuration = viewEnd - viewStart;
  if (viewDuration <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {annotations.map((ann, i) => {
        if (ann.midTime < viewStart || ann.midTime > viewEnd) return null;
        const x = ((ann.midTime - viewStart) / viewDuration) * width;
        const y = Math.max(20, height - (ann.avgF1 / maxFreq) * height - 10);

        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              fontSize: '18px',
              fontFamily: 'serif',
              fontWeight: 'bold',
              color: '#cdd6f4',
              backgroundColor: 'rgba(30, 30, 46, 0.7)',
              padding: '1px 4px',
              borderRadius: '3px',
              lineHeight: 1,
            }}
          >
            {ann.ipa}
          </span>
        );
      })}
    </div>
  );
};

export default IpaOverlay;
