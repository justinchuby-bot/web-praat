import { describe, expect, it } from 'vitest';
import { AudioEditorHistory, ReplaceRangeCommand } from '../src/audio/editor';

describe('audio editor history', () => {
  it('cuts and pastes sample ranges', () => {
    const history = new AudioEditorHistory(new Float32Array([1, 2, 3, 4]));
    history.copy(1, 3);
    const cutState = history.execute(new ReplaceRangeCommand(1, 3, new Float32Array(0)));
    expect(Array.from(cutState.samples)).toEqual([1, 4]);
    const pasted = history.execute(new ReplaceRangeCommand(2, 2, cutState.clipboard ?? new Float32Array(0)));
    expect(Array.from(pasted.samples)).toEqual([1, 4, 2, 3]);
  });

  it('supports undo and redo', () => {
    const history = new AudioEditorHistory(new Float32Array([1, 2, 3]));
    history.execute(new ReplaceRangeCommand(1, 2, new Float32Array([9, 9])));
    expect(Array.from(history.getState().samples)).toEqual([1, 9, 9, 3]);
    history.undo();
    expect(Array.from(history.getState().samples)).toEqual([1, 2, 3]);
    history.redo();
    expect(Array.from(history.getState().samples)).toEqual([1, 9, 9, 3]);
  });
});
