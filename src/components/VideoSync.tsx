import { useCallback, useEffect, useRef, useState } from 'react';

export interface VideoSyncProps {
  /** Current playback time in seconds */
  currentTime: number;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Called when video file is loaded — provides extracted audio samples + sampleRate */
  onAudioExtracted?: (samples: Float32Array, sampleRate: number) => void;
  /** Called when user seeks within the video */
  onSeek?: (time: number) => void;
}

/**
 * VideoSync — displays a video element synchronized to the main audio cursor.
 * Supports loading video files, extracting audio, and bidirectional time sync.
 */
export function VideoSync({ currentTime, isPlaying, onAudioExtracted, onSeek }: VideoSyncProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const syncingRef = useRef(false);

  // Sync video time to external currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc || syncingRef.current) return;
    const diff = Math.abs(video.currentTime - currentTime);
    if (diff > 0.05) {
      video.currentTime = currentTime;
    }
  }, [currentTime, videoSrc]);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, videoSrc]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    // Create object URL for video playback
    const url = URL.createObjectURL(file);
    setVideoSrc(url);

    // Extract audio from video
    if (onAudioExtracted) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const samples = audioBuffer.getChannelData(0);
        onAudioExtracted(new Float32Array(samples), audioBuffer.sampleRate);
        await audioCtx.close();
      } catch (err) {
        console.warn('Could not extract audio from video:', err);
      }
    }
  }, [onAudioExtracted]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      // Mute video — audio comes from main player
      video.muted = true;
    }
  }, []);

  const handleVideoSeek = useCallback(() => {
    const video = videoRef.current;
    if (!video || !onSeek) return;
    syncingRef.current = true;
    onSeek(video.currentTime);
    setTimeout(() => { syncingRef.current = false; }, 100);
  }, [onSeek]);

  const handleClose = useCallback(() => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);
    setFileName('');
    setDuration(0);
  }, [videoSrc]);

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-900 rounded-lg border border-zinc-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Video Sync</h3>
        {videoSrc && (
          <button
            onClick={handleClose}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded hover:bg-zinc-700"
          >
            Close
          </button>
        )}
      </div>

      {!videoSrc ? (
        <label className="flex items-center justify-center h-32 border-2 border-dashed border-zinc-600 rounded cursor-pointer hover:border-zinc-400 transition-colors">
          <div className="text-center text-zinc-500">
            <p className="text-sm">Drop or click to load video</p>
            <p className="text-xs mt-1">MP4, WebM, MOV</p>
          </div>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      ) : (
        <div className="flex flex-col gap-1">
          <video
            ref={videoRef}
            src={videoSrc}
            onLoadedMetadata={handleLoadedMetadata}
            onSeeked={handleVideoSeek}
            className="w-full rounded bg-black max-h-64 object-contain"
            playsInline
            muted
          />
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="truncate max-w-[60%]">{fileName}</span>
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
