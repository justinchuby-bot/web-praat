/**
 * ELAN (.eaf) import/export — converts between ELAN Annotation Format and TextGrid.
 *
 * ELAN XML structure:
 *   <ANNOTATION_DOCUMENT>
 *     <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">
 *       <MEDIA_DESCRIPTOR MEDIA_URL="..." MIME_TYPE="audio/x-wav"/>
 *     </HEADER>
 *     <TIME_ORDER>
 *       <TIME_SLOT TIME_SLOT_ID="ts1" TIME_VALUE="0"/>
 *       ...
 *     </TIME_ORDER>
 *     <TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="words" PARENT_REF="...">
 *       <ANNOTATION>
 *         <ALIGNABLE_ANNOTATION ANNOTATION_ID="a1" TIME_SLOT_REF1="ts1" TIME_SLOT_REF2="ts2">
 *           <ANNOTATION_VALUE>hello</ANNOTATION_VALUE>
 *         </ALIGNABLE_ANNOTATION>
 *       </ANNOTATION>
 *     </TIER>
 *   </ANNOTATION_DOCUMENT>
 */

import type { TextGrid, TextGridTier, Interval, Point } from '../types';
import { createId } from '../utils/id';

// ---------- IMPORT ----------

export function parseElan(xml: string): TextGrid {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid EAF XML: ${parseError.textContent}`);
  }

  // Build time slot map (id → seconds)
  const timeSlots = new Map<string, number>();
  const timeUnits = doc.documentElement.querySelector('HEADER')?.getAttribute('TIME_UNITS') ?? 'milliseconds';
  const divisor = timeUnits === 'milliseconds' ? 1000 : 1;

  for (const ts of doc.querySelectorAll('TIME_ORDER > TIME_SLOT')) {
    const id = ts.getAttribute('TIME_SLOT_ID') ?? '';
    const val = ts.getAttribute('TIME_VALUE');
    if (id && val !== null) {
      timeSlots.set(id, Number(val) / divisor);
    }
  }

  // Determine document duration
  let xmax = 0;
  for (const t of timeSlots.values()) {
    if (t > xmax) xmax = t;
  }

  // Parse tiers
  const tiers: TextGridTier[] = [];
  const tierElements = doc.querySelectorAll('TIER');

  // Collect ref annotations (for symbolic subdivision / reference tiers)
  const refAnnotations = new Map<string, { parentRef: string; previous: string; value: string }>();
  for (const tierEl of tierElements) {
    for (const ann of tierEl.querySelectorAll('REF_ANNOTATION')) {
      const annId = ann.getAttribute('ANNOTATION_ID') ?? '';
      const annRef = ann.getAttribute('ANNOTATION_REF') ?? '';
      const prev = ann.getAttribute('PREVIOUS_ANNOTATION') ?? '';
      const value = ann.querySelector('ANNOTATION_VALUE')?.textContent ?? '';
      if (annId) {
        refAnnotations.set(annId, { parentRef: annRef, previous: prev, value });
      }
    }
  }

  // Map annotation ids → time refs for alignable annotations
  const alignableMap = new Map<string, { ts1: string; ts2: string }>();
  for (const tierEl of tierElements) {
    for (const ann of tierEl.querySelectorAll('ALIGNABLE_ANNOTATION')) {
      const annId = ann.getAttribute('ANNOTATION_ID') ?? '';
      const ts1 = ann.getAttribute('TIME_SLOT_REF1') ?? '';
      const ts2 = ann.getAttribute('TIME_SLOT_REF2') ?? '';
      if (annId) alignableMap.set(annId, { ts1, ts2 });
    }
  }

  // Build parent tier id mapping
  const tierParentMap = new Map<string, string>();

  for (const tierEl of tierElements) {
    const tierId = tierEl.getAttribute('TIER_ID') ?? `tier_${tiers.length}`;
    const parentRef = tierEl.getAttribute('PARENT_REF') ?? '';

    const alignableAnns = tierEl.querySelectorAll('ALIGNABLE_ANNOTATION');
    const refAnns = tierEl.querySelectorAll('REF_ANNOTATION');

    if (alignableAnns.length > 0) {
      // Alignable → interval tier
      const intervals: Interval[] = [];
      for (const ann of alignableAnns) {
        const ts1 = ann.getAttribute('TIME_SLOT_REF1') ?? '';
        const ts2 = ann.getAttribute('TIME_SLOT_REF2') ?? '';
        const value = ann.querySelector('ANNOTATION_VALUE')?.textContent ?? '';
        const start = timeSlots.get(ts1) ?? 0;
        const end = timeSlots.get(ts2) ?? 0;
        intervals.push({ id: createId('interval'), start, end, label: value });
      }
      intervals.sort((a, b) => a.start - b.start);

      const tier: TextGridTier = {
        id: createId('tier'),
        name: tierId,
        kind: 'interval',
        intervals,
      };
      tiers.push(tier);
      tierParentMap.set(tierId, parentRef);
    } else if (refAnns.length > 0) {
      // Ref annotations → resolve time from parent alignable, treat as point tier
      const points: Point[] = [];
      for (const ann of refAnns) {
        const annRef = ann.getAttribute('ANNOTATION_REF') ?? '';
        const value = ann.querySelector('ANNOTATION_VALUE')?.textContent ?? '';
        // Find time from parent alignable
        const parentAlignable = alignableMap.get(annRef);
        if (parentAlignable) {
          const time = timeSlots.get(parentAlignable.ts1) ?? 0;
          points.push({ id: createId('point'), time, label: value });
        }
      }
      points.sort((a, b) => a.time - b.time);

      const tier: TextGridTier = {
        id: createId('tier'),
        name: tierId,
        kind: 'point',
        points,
      };
      tiers.push(tier);
      tierParentMap.set(tierId, parentRef);
    }
  }

  // Resolve parentId on tiers
  const tierNameToId = new Map<string, string>();
  for (const t of tiers) tierNameToId.set(t.name, t.id);
  for (const t of tiers) {
    const parentName = tierParentMap.get(t.name);
    if (parentName) {
      const parentTierId = tierNameToId.get(parentName);
      if (parentTierId) {
        (t as TextGridTier & { parentId?: string }).parentId = parentTierId;
      }
    }
  }

  return { xmin: 0, xmax: xmax || 1, tiers };
}

// ---------- EXPORT ----------

export function serializeElan(grid: TextGrid, mediaUrl = ''): string {
  const lines: string[] = [];
  const now = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<ANNOTATION_DOCUMENT AUTHOR="" DATE="${now}" FORMAT="3.0" VERSION="3.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd">`);
  lines.push(`  <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">`);
  if (mediaUrl) {
    lines.push(`    <MEDIA_DESCRIPTOR MEDIA_URL="${escapeXml(mediaUrl)}" MIME_TYPE="audio/x-wav"/>`);
  }
  lines.push(`  </HEADER>`);

  // Build time slots
  const timeSlots: { id: string; ms: number }[] = [];
  let tsCounter = 1;
  const timeToSlotId = new Map<number, string>();

  function getSlotId(seconds: number): string {
    const ms = Math.round(seconds * 1000);
    const existing = timeToSlotId.get(ms);
    if (existing) return existing;
    const id = `ts${tsCounter++}`;
    timeSlots.push({ id, ms });
    timeToSlotId.set(ms, id);
    return id;
  }

  // Pre-collect all time values
  for (const tier of grid.tiers) {
    if (tier.kind === 'interval') {
      for (const interval of tier.intervals) {
        getSlotId(interval.start);
        getSlotId(interval.end);
      }
    } else {
      for (const point of tier.points) {
        getSlotId(point.time);
        // Points need a tiny duration in ELAN
        getSlotId(point.time + 0.001);
      }
    }
  }

  // Sort time slots by ms
  timeSlots.sort((a, b) => a.ms - b.ms);

  lines.push(`  <TIME_ORDER>`);
  for (const ts of timeSlots) {
    lines.push(`    <TIME_SLOT TIME_SLOT_ID="${ts.id}" TIME_VALUE="${ts.ms}"/>`);
  }
  lines.push(`  </TIME_ORDER>`);

  // Build tier id → tier name map for parent resolution
  const tierIdToName = new Map<string, string>();
  for (const tier of grid.tiers) {
    tierIdToName.set(tier.id, tier.name);
  }

  // Write tiers
  let annCounter = 1;
  const linguisticTypes = new Set<string>();
  linguisticTypes.add('default-lt');

  for (const tier of grid.tiers) {
    const parentRef = tier.parentId ? tierIdToName.get(tier.parentId) : undefined;
    const ltRef = 'default-lt';
    const parentAttr = parentRef ? ` PARENT_REF="${escapeXml(parentRef)}"` : '';
    lines.push(`  <TIER LINGUISTIC_TYPE_REF="${ltRef}" TIER_ID="${escapeXml(tier.name)}"${parentAttr}>`);

    if (tier.kind === 'interval') {
      for (const interval of tier.intervals) {
        const ts1 = getSlotId(interval.start);
        const ts2 = getSlotId(interval.end);
        const annId = `a${annCounter++}`;
        lines.push(`    <ANNOTATION>`);
        lines.push(`      <ALIGNABLE_ANNOTATION ANNOTATION_ID="${annId}" TIME_SLOT_REF1="${ts1}" TIME_SLOT_REF2="${ts2}">`);
        lines.push(`        <ANNOTATION_VALUE>${escapeXml(interval.label)}</ANNOTATION_VALUE>`);
        lines.push(`      </ALIGNABLE_ANNOTATION>`);
        lines.push(`    </ANNOTATION>`);
      }
    } else {
      for (const point of tier.points) {
        const ts1 = getSlotId(point.time);
        const ts2 = getSlotId(point.time + 0.001);
        const annId = `a${annCounter++}`;
        lines.push(`    <ANNOTATION>`);
        lines.push(`      <ALIGNABLE_ANNOTATION ANNOTATION_ID="${annId}" TIME_SLOT_REF1="${ts1}" TIME_SLOT_REF2="${ts2}">`);
        lines.push(`        <ANNOTATION_VALUE>${escapeXml(point.label)}</ANNOTATION_VALUE>`);
        lines.push(`      </ALIGNABLE_ANNOTATION>`);
        lines.push(`    </ANNOTATION>`);
      }
    }

    lines.push(`  </TIER>`);
  }

  // Linguistic type
  lines.push(`  <LINGUISTIC_TYPE GRAPHIC_REFERENCES="false" LINGUISTIC_TYPE_ID="default-lt" TIME_ALIGNABLE="true"/>`);
  lines.push(`</ANNOTATION_DOCUMENT>`);

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
