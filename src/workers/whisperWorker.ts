/**
 * Web Worker for Whisper transcription.
 * Runs transformers.js inference off the main thread.
 */
import { pipeline } from '@huggingface/transformers';

let cachedPipeline: any = null;
let cachedModelId: string | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, model, audio, language } = event.data;

  if (type === 'transcribe') {
    try {
      // Load model
      if (!cachedPipeline || cachedModelId !== model) {
        self.postMessage({ type: 'progress', status: 'downloading', progress: 0 });
        const isWav2vec = model.includes('wav2vec2');
        cachedPipeline = await pipeline('automatic-speech-recognition', model, {
          dtype: isWav2vec ? 'fp32' : 'q4',
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
      // Don't pass language/task for English-only or IPA models
      const isEnglishOnly = model.includes('.en');
      const isIpa = model.includes('ipa');
      const isWav2vec = model.includes('wav2vec2');
      const result = await cachedPipeline(audio, {
        return_timestamps: isWav2vec ? 'char' : isIpa ? false : 'word',
        ...(!isEnglishOnly && !isIpa && !isWav2vec ? { language: language || undefined, task: 'transcribe' } : {}),
        chunk_length_s: isWav2vec ? undefined : 30,
        stride_length_s: isWav2vec ? undefined : 5,
      });

      self.postMessage({ type: 'result', result });
    } catch (err) {
      self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }
};
