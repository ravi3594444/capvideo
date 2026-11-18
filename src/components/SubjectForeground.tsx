import { useEffect, useRef, useState, type RefObject } from 'react';

export function SubjectForeground({ videoRef, source }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  source: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!video || !canvas || !ctx) return;

    let active = true;
    let failed = false;
    let frame = 0;
    let busy = false;
    let lastTime = -1;
    let lastSample = -Infinity;
    setStatus('loading');

    const model = import('../utils/subjectMask').then(({ createSubjectMask }) => createSubjectMask());
    const sample = async (now: number) => {
      if (!active || failed || busy || video.seeking || video.readyState < 2 || video.currentTime === lastTime) return;
      busy = true;
      lastSample = now;
      lastTime = video.currentTime;
      try {
        const mask = await model;
        if (!active) return;
        await mask.update(video);
        if (!active) return;
        const ratio = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.max(1, Math.round(video.videoWidth * ratio));
        const height = Math.max(1, Math.round(video.videoHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        mask.drawForeground(ctx, video, canvas.width, canvas.height);
        setStatus('ready');
      } catch {
        if (active) {
          failed = true;
          setStatus('error');
        }
      } finally {
        busy = false;
        if (lastTime === -1) void sample(performance.now());
      }
    };
    const tick = (now: number) => {
      if (!video.paused && now - lastSample >= 80) void sample(now);
      if (!failed) frame = requestAnimationFrame(tick);
    };
    const updatePausedFrame = () => {
      lastTime = -1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      void sample(performance.now());
    };
    video.addEventListener('loadeddata', updatePausedFrame);
    video.addEventListener('seeked', updatePausedFrame);
    void sample(performance.now());
    frame = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      video.removeEventListener('loadeddata', updatePausedFrame);
      video.removeEventListener('seeked', updatePausedFrame);
      void model.then(mask => mask.clear()).catch(() => {});
    };
  }, [videoRef, source]);

  return (
    <>
      <canvas ref={canvasRef} className="caption-subject-foreground" aria-hidden="true" />
      {status !== 'ready' && <span className="caption-subject-status" role="status">
        {status === 'loading' ? 'Loading subject mask…' : 'Subject masking is unavailable in this browser.'}
      </span>}
    </>
  );
}
