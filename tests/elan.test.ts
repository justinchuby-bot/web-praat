// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseElan, serializeElan } from '../src/textgrid/elan';
import type { TextGrid } from '../src/types';

describe('ELAN (.eaf) import', () => {
  const sampleEaf = `<?xml version="1.0" encoding="UTF-8"?>
<ANNOTATION_DOCUMENT AUTHOR="" DATE="2024-01-01T00:00:00+00:00" FORMAT="3.0" VERSION="3.0">
  <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">
    <MEDIA_DESCRIPTOR MEDIA_URL="file:///test.wav" MIME_TYPE="audio/x-wav"/>
  </HEADER>
  <TIME_ORDER>
    <TIME_SLOT TIME_SLOT_ID="ts1" TIME_VALUE="0"/>
    <TIME_SLOT TIME_SLOT_ID="ts2" TIME_VALUE="500"/>
    <TIME_SLOT TIME_SLOT_ID="ts3" TIME_VALUE="1000"/>
    <TIME_SLOT TIME_SLOT_ID="ts4" TIME_VALUE="1500"/>
  </TIME_ORDER>
  <TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="words">
    <ANNOTATION>
      <ALIGNABLE_ANNOTATION ANNOTATION_ID="a1" TIME_SLOT_REF1="ts1" TIME_SLOT_REF2="ts2">
        <ANNOTATION_VALUE>hello</ANNOTATION_VALUE>
      </ALIGNABLE_ANNOTATION>
    </ANNOTATION>
    <ANNOTATION>
      <ALIGNABLE_ANNOTATION ANNOTATION_ID="a2" TIME_SLOT_REF1="ts2" TIME_SLOT_REF2="ts3">
        <ANNOTATION_VALUE>world</ANNOTATION_VALUE>
      </ALIGNABLE_ANNOTATION>
    </ANNOTATION>
  </TIER>
  <TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="phones" PARENT_REF="words">
    <ANNOTATION>
      <ALIGNABLE_ANNOTATION ANNOTATION_ID="a3" TIME_SLOT_REF1="ts1" TIME_SLOT_REF2="ts2">
        <ANNOTATION_VALUE>h</ANNOTATION_VALUE>
      </ALIGNABLE_ANNOTATION>
    </ANNOTATION>
    <ANNOTATION>
      <ALIGNABLE_ANNOTATION ANNOTATION_ID="a4" TIME_SLOT_REF1="ts3" TIME_SLOT_REF2="ts4">
        <ANNOTATION_VALUE>w</ANNOTATION_VALUE>
      </ALIGNABLE_ANNOTATION>
    </ANNOTATION>
  </TIER>
  <LINGUISTIC_TYPE GRAPHIC_REFERENCES="false" LINGUISTIC_TYPE_ID="default-lt" TIME_ALIGNABLE="true"/>
</ANNOTATION_DOCUMENT>`;

  it('parses tiers from EAF XML', () => {
    const grid = parseElan(sampleEaf);
    expect(grid.tiers).toHaveLength(2);
    expect(grid.xmin).toBe(0);
    expect(grid.xmax).toBe(1.5);
  });

  it('parses interval annotations with correct times', () => {
    const grid = parseElan(sampleEaf);
    const tier = grid.tiers[0];
    expect(tier.kind).toBe('interval');
    if (tier.kind === 'interval') {
      expect(tier.intervals).toHaveLength(2);
      expect(tier.intervals[0].start).toBe(0);
      expect(tier.intervals[0].end).toBe(0.5);
      expect(tier.intervals[0].label).toBe('hello');
      expect(tier.intervals[1].start).toBe(0.5);
      expect(tier.intervals[1].end).toBe(1);
      expect(tier.intervals[1].label).toBe('world');
    }
  });

  it('preserves tier names', () => {
    const grid = parseElan(sampleEaf);
    expect(grid.tiers[0].name).toBe('words');
    expect(grid.tiers[1].name).toBe('phones');
  });

  it('resolves parent-child relationships', () => {
    const grid = parseElan(sampleEaf);
    const phonesTier = grid.tiers[1];
    const wordsTier = grid.tiers[0];
    expect(phonesTier.parentId).toBe(wordsTier.id);
  });

  it('throws on invalid XML', () => {
    expect(() => parseElan('<not valid xml')).toThrow('Invalid EAF XML');
  });

  it('handles empty tiers gracefully', () => {
    const emptyEaf = `<?xml version="1.0" encoding="UTF-8"?>
<ANNOTATION_DOCUMENT>
  <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds"/>
  <TIME_ORDER>
    <TIME_SLOT TIME_SLOT_ID="ts1" TIME_VALUE="0"/>
    <TIME_SLOT TIME_SLOT_ID="ts2" TIME_VALUE="2000"/>
  </TIME_ORDER>
  <TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="empty"/>
</ANNOTATION_DOCUMENT>`;
    const grid = parseElan(emptyEaf);
    expect(grid.tiers).toHaveLength(0); // No annotations = no tier created
    expect(grid.xmax).toBe(2);
  });
});

describe('ELAN (.eaf) export', () => {
  const grid: TextGrid = {
    xmin: 0,
    xmax: 2,
    tiers: [
      {
        id: 'tier1',
        name: 'sentence',
        kind: 'interval',
        intervals: [
          { id: 'i1', start: 0, end: 1, label: 'hello' },
          { id: 'i2', start: 1, end: 2, label: 'world' },
        ],
      },
      {
        id: 'tier2',
        name: 'points',
        kind: 'point',
        points: [
          { id: 'p1', time: 0.5, label: 'click' },
          { id: 'p2', time: 1.5, label: 'beep' },
        ],
      },
    ],
  };

  it('produces valid XML', () => {
    const xml = serializeElan(grid);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<ANNOTATION_DOCUMENT');
    expect(xml).toContain('</ANNOTATION_DOCUMENT>');
  });

  it('includes time slots in milliseconds', () => {
    const xml = serializeElan(grid);
    expect(xml).toContain('TIME_VALUE="0"');
    expect(xml).toContain('TIME_VALUE="1000"');
    expect(xml).toContain('TIME_VALUE="2000"');
  });

  it('exports interval tiers as alignable annotations', () => {
    const xml = serializeElan(grid);
    expect(xml).toContain('TIER_ID="sentence"');
    expect(xml).toContain('<ANNOTATION_VALUE>hello</ANNOTATION_VALUE>');
    expect(xml).toContain('<ANNOTATION_VALUE>world</ANNOTATION_VALUE>');
  });

  it('exports point tiers as short alignable annotations', () => {
    const xml = serializeElan(grid);
    expect(xml).toContain('TIER_ID="points"');
    expect(xml).toContain('TIME_VALUE="500"');
    expect(xml).toContain('<ANNOTATION_VALUE>click</ANNOTATION_VALUE>');
  });

  it('includes media URL when provided', () => {
    const xml = serializeElan(grid, 'file:///audio.wav');
    expect(xml).toContain('MEDIA_URL="file:///audio.wav"');
  });

  it('escapes special XML characters', () => {
    const specialGrid: TextGrid = {
      xmin: 0,
      xmax: 1,
      tiers: [{
        id: 't1',
        name: 'test<tier>',
        kind: 'interval',
        intervals: [{ id: 'i1', start: 0, end: 1, label: 'a & b "quoted"' }],
      }],
    };
    const xml = serializeElan(specialGrid);
    expect(xml).toContain('test&lt;tier&gt;');
    expect(xml).toContain('a &amp; b &quot;quoted&quot;');
  });

  it('preserves parent references', () => {
    const parentGrid: TextGrid = {
      xmin: 0,
      xmax: 1,
      tiers: [
        { id: 'tier1', name: 'parent', kind: 'interval', intervals: [{ id: 'i1', start: 0, end: 1, label: 'x' }] },
        { id: 'tier2', name: 'child', kind: 'interval', intervals: [{ id: 'i2', start: 0, end: 1, label: 'y' }], parentId: 'tier1' },
      ],
    };
    const xml = serializeElan(parentGrid);
    expect(xml).toContain('PARENT_REF="parent"');
  });
});

describe('ELAN roundtrip', () => {
  it('roundtrips interval tiers', () => {
    const grid: TextGrid = {
      xmin: 0,
      xmax: 3,
      tiers: [{
        id: 'tier1',
        name: 'words',
        kind: 'interval',
        intervals: [
          { id: 'i1', start: 0, end: 1.5, label: 'first' },
          { id: 'i2', start: 1.5, end: 3, label: 'second' },
        ],
      }],
    };
    const xml = serializeElan(grid);
    const parsed = parseElan(xml);
    expect(parsed.tiers).toHaveLength(1);
    expect(parsed.tiers[0].kind).toBe('interval');
    if (parsed.tiers[0].kind === 'interval') {
      expect(parsed.tiers[0].intervals).toHaveLength(2);
      expect(parsed.tiers[0].intervals[0].label).toBe('first');
      expect(parsed.tiers[0].intervals[0].start).toBe(0);
      expect(parsed.tiers[0].intervals[0].end).toBe(1.5);
      expect(parsed.tiers[0].intervals[1].label).toBe('second');
    }
  });

  it('roundtrips point tiers', () => {
    const grid: TextGrid = {
      xmin: 0,
      xmax: 2,
      tiers: [{
        id: 'tier1',
        name: 'events',
        kind: 'point',
        points: [
          { id: 'p1', time: 0.75, label: 'onset' },
        ],
      }],
    };
    const xml = serializeElan(grid);
    const parsed = parseElan(xml);
    expect(parsed.tiers).toHaveLength(1);
    expect(parsed.tiers[0].kind).toBe('interval');
    // Points become short intervals in ELAN
    if (parsed.tiers[0].kind === 'interval') {
      expect(parsed.tiers[0].intervals[0].label).toBe('onset');
      expect(parsed.tiers[0].intervals[0].start).toBeCloseTo(0.75, 2);
    }
  });
});
