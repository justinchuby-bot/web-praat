export interface AudioEditState {
  samples: Float32Array<ArrayBufferLike>;
  clipboard: Float32Array<ArrayBufferLike> | null;
}

export interface AudioEditCommand {
  apply(state: AudioEditState): AudioEditState;
  revert(state: AudioEditState): AudioEditState;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length, index));
}

function sliceConcat(parts: Array<Float32Array<ArrayBufferLike>>): Float32Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function copySamples(samples: Float32Array<ArrayBufferLike>, start: number, end: number): Float32Array {
  const safeStart = clampIndex(Math.min(start, end), samples.length);
  const safeEnd = clampIndex(Math.max(start, end), samples.length);
  return samples.slice(safeStart, safeEnd);
}

function deleteSamples(samples: Float32Array<ArrayBufferLike>, start: number, end: number): Float32Array {
  const safeStart = clampIndex(Math.min(start, end), samples.length);
  const safeEnd = clampIndex(Math.max(start, end), samples.length);
  return sliceConcat([samples.slice(0, safeStart), samples.slice(safeEnd)]);
}

function insertSamples(
  samples: Float32Array<ArrayBufferLike>,
  insertAt: number,
  pasted: Float32Array<ArrayBufferLike>
): Float32Array {
  const safeIndex = clampIndex(insertAt, samples.length);
  return sliceConcat([samples.slice(0, safeIndex), pasted, samples.slice(safeIndex)]);
}

export class ReplaceRangeCommand implements AudioEditCommand {
  private removed: Float32Array<ArrayBufferLike>;

  constructor(
    private readonly start: number,
    private readonly end: number,
    private readonly inserted: Float32Array<ArrayBufferLike>
  ) {
    this.removed = new Float32Array(0);
  }

  apply(state: AudioEditState): AudioEditState {
    this.removed = copySamples(state.samples, this.start, this.end);
    const withoutRange = deleteSamples(state.samples, this.start, this.end);
    const nextSamples = insertSamples(withoutRange, this.start, this.inserted);
    return {
      samples: nextSamples,
      clipboard: this.inserted.length > 0 ? Float32Array.from(this.inserted) : state.clipboard,
    };
  }

  revert(state: AudioEditState): AudioEditState {
    const revertedRemoved = deleteSamples(state.samples, this.start, this.start + this.inserted.length);
    const nextSamples = insertSamples(revertedRemoved, this.start, this.removed);
    return { ...state, samples: nextSamples };
  }
}

export class AudioEditorHistory {
  private undoStack: AudioEditCommand[] = [];
  private redoStack: AudioEditCommand[] = [];
  private state: AudioEditState;

  constructor(initialSamples: Float32Array<ArrayBufferLike>) {
    this.state = { samples: Float32Array.from(initialSamples), clipboard: null };
  }

  setSamples(samples: Float32Array<ArrayBufferLike>): void {
    this.state = { samples: Float32Array.from(samples), clipboard: this.state.clipboard };
    this.undoStack = [];
    this.redoStack = [];
  }

  getState(): AudioEditState {
    return {
      samples: Float32Array.from(this.state.samples),
      clipboard: this.state.clipboard ? Float32Array.from(this.state.clipboard) : null,
    };
  }

  copy(start: number, end: number): Float32Array {
    const copied = copySamples(this.state.samples, start, end);
    this.state = { ...this.state, clipboard: copied };
    return copied;
  }

  execute(command: AudioEditCommand): AudioEditState {
    this.state = command.apply(this.state);
    this.undoStack.push(command);
    this.redoStack = [];
    return this.getState();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): AudioEditState | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    this.state = command.revert(this.state);
    this.redoStack.push(command);
    return this.getState();
  }

  redo(): AudioEditState | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    this.state = command.apply(this.state);
    this.undoStack.push(command);
    return this.getState();
  }
}
