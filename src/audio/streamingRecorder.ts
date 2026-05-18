/**
 * Streaming audio recorder that provides real-time sample data
 * for live spectrogram visualization during recording.
 */

export interface StreamingRecorderCallbacks {
  /** Called with new audio chunk during recording */
  onData: (samples: Float32Array, sampleRate: number) => void;
}

export class StreamingRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private _isRecording = false;
  private callbacks: StreamingRecorderCallbacks | null = null;

  get isRecording(): boolean {
    return this._isRecording;
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? 44100;
  }

  async start(callbacks: StreamingRecorderCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.chunks = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaStream = stream;
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // Use ScriptProcessorNode for raw sample access (AudioWorklet would be better
    // but requires separate file and more complexity)
    const bufferSize = 4096;
    this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.scriptNode.onaudioprocess = (event) => {
      if (!this._isRecording) return;
      const inputData = event.inputBuffer.getChannelData(0);
      const copy = Float32Array.from(inputData);
      this.chunks.push(copy);
      this.callbacks?.onData(copy, this.audioContext!.sampleRate);
    };

    this.sourceNode.connect(this.scriptNode);
    this.scriptNode.connect(this.audioContext.destination);
    this._isRecording = true;
  }

  stop(): { samples: Float32Array; sampleRate: number } {
    this._isRecording = false;

    this.scriptNode?.disconnect();
    this.sourceNode?.disconnect();
    this.mediaStream?.getTracks().forEach((t) => t.stop());

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    this.audioContext?.close();

    // Concatenate all chunks
    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.scriptNode = null;
    this.callbacks = null;

    return { samples, sampleRate };
  }

  /** Get all accumulated samples so far */
  getAllSamples(): Float32Array {
    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    return samples;
  }
}
