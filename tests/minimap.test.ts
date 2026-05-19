import { describe, it, expect, vi } from 'vitest';

// Unit test the Minimap logic (time/viewport calculations)
describe('Minimap', () => {
  it('viewport rectangle maps view range to canvas width', () => {
    const duration = 10; // seconds
    const viewRange = { start: 2, end: 5 };
    const canvasWidth = 200;
    const vx1 = (viewRange.start / duration) * canvasWidth;
    const vx2 = (viewRange.end / duration) * canvasWidth;
    expect(vx1).toBe(40);
    expect(vx2).toBe(100);
  });

  it('click outside viewport centers the view', () => {
    const duration = 10;
    const viewDuration = 3; // current view span
    const clickTime = 7; // clicked at 7s

    let newStart = clickTime - viewDuration / 2;
    newStart = Math.max(0, Math.min(duration - viewDuration, newStart));
    const newEnd = newStart + viewDuration;

    expect(newStart).toBe(5.5);
    expect(newEnd).toBe(8.5);
  });

  it('clamps start to 0 when centering near beginning', () => {
    const duration = 10;
    const viewDuration = 4;
    const clickTime = 1;

    let newStart = clickTime - viewDuration / 2;
    newStart = Math.max(0, Math.min(duration - viewDuration, newStart));
    expect(newStart).toBe(0);
  });

  it('clamps end to duration when centering near end', () => {
    const duration = 10;
    const viewDuration = 4;
    const clickTime = 9;

    let newStart = clickTime - viewDuration / 2;
    newStart = Math.max(0, Math.min(duration - viewDuration, newStart));
    expect(newStart).toBe(6);
    expect(newStart + viewDuration).toBe(10);
  });

  it('drag-move preserves view duration', () => {
    const duration = 10;
    const origStart = 2;
    const origEnd = 5;
    const deltaTime = 1.5; // dragged right by 1.5s

    const viewDur = origEnd - origStart;
    let newStart = origStart + deltaTime;
    newStart = Math.max(0, Math.min(duration - viewDur, newStart));

    expect(viewDur).toBe(3);
    expect(newStart).toBe(3.5);
    expect(newStart + viewDur).toBe(6.5);
  });

  it('resize-left clamps to not exceed right edge', () => {
    const origEnd = 5;
    const draggedTime = 6; // tried to drag past end

    const newStart = Math.max(0, Math.min(draggedTime, origEnd - 0.01));
    expect(newStart).toBe(4.99);
  });

  it('resize-right clamps to duration', () => {
    const duration = 10;
    const origStart = 2;
    const draggedTime = 12;

    const newEnd = Math.min(duration, Math.max(origStart + 0.01, draggedTime));
    expect(newEnd).toBe(10);
  });
});
