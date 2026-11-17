import { useEffect, useState, type RefObject } from 'react';

/**
 * Captures the current frame of the studio <video> as a small JPEG data URL so
 * previews (e.g. caption style audition) can render on the user's real footage.
 * Re-captures whenever the user scrubs or the clip finishes loading.
 */
export function useVideoFrame(
  videoRef: RefObject<HTMLVideoElement | null>,
  videoUrl: string | null,
  maxWidth = 480
): string | null {
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) {
      setFrame(null);
      return;
    }

    let cancelled = false;
    const capture = () => {
      if (cancelled || vid.readyState < 2 || !vid.videoWidth || !vid.videoHeight) return;
      try {
        const scale = Math.min(1, maxWidth / vid.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vid.videoWidth * scale);
        canvas.height = Math.round(vid.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        setFrame(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        setFrame(null);
      }
    };

    capture();
    vid.addEventListener('loadeddata', capture);
    vid.addEventListener('seeked', capture);
    vid.addEventListener('pause', capture);
    return () => {
      cancelled = true;
      vid.removeEventListener('loadeddata', capture);
      vid.removeEventListener('seeked', capture);
      vid.removeEventListener('pause', capture);
    };
  }, [videoRef, videoUrl, maxWidth]);

  return frame;
}
