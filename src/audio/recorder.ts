/**
 * Web Audio recording utility.
 */

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private chunks: Blob[] = [];
  private _isRecording = false;

  get isRecording(): boolean {
    return this._isRecording;
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.start();
    this._isRecording = true;
  }

  async stop(): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.audioContext) {
        reject(new Error('Not recording'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this._isRecording = false;
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        try {
          const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
          resolve(audioBuffer);
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      this.audioContext?.close();
      this.audioContext = null;
    });
  }
}

/**
 * Load an audio file (wav/mp3/ogg) and decode to AudioBuffer.
 */
export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();
  return buffer;
}
