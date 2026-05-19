/**
 * Load an audio file (wav/mp3/ogg) and decode to AudioBuffer.
 */
export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}
