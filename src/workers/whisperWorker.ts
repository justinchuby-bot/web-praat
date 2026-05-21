/**
 * Web Worker for Whisper transcription.
 * Runs transformers.js inference off the main thread.
 */
import { pipeline } from '@huggingface/transformers';

let cachedPipeline: any = null;
let cachedModelId: string | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, model, audio, language, revision } = event.data;

  if (type === 'transcribe') {
    try {
      // Load model
      if (!cachedPipeline || cachedModelId !== model) {
        self.postMessage({ type: 'progress', status: 'downloading', progress: 0 });
        cachedPipeline = await pipeline('automatic-speech-recognition', model, {
          revision: revision || 'output_attentions',
          dtype: 'q4',
          device: 'wasm',
          progress_callback: (data: any) => {
            if (data.status === 'progress' && data.progress != null) {
              self.postMessage({ type: 'progress', status: 'downloading', progress: data.progress });
            } else if (data.status === 'done') {
              self.postMessage({ type: 'progress', status: 'loading' });
            }
          },
        });
        cachedModelId = model;
      }

      self.postMessage({ type: 'progress', status: 'transcribing' });

      // Run transcription
      const result = await cachedPipeline(audio, {
        return_timestamps: 'word',
        language: language || undefined,
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      self.postMessage({ type: 'result', result });
    } catch (err) {
      self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }
};
