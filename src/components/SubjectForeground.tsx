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
    let mask: ReturnType<typeof import('../utils/subjectMask').createSubjectMask> | undefined;
    setStatus('loading');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const model = import('../utils/subjectMask').then(({ createSubjectMask }) => createSubjectMask());
    const paint = () => {
      if (!mask || video.seeking || video.readyState < 2) return false;
      const ratio = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * ratio));
      const height = Math.max(1, Math.round(video.videoHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return mask.drawForeground(ctx, video, width, height);
    };

    const sample = async (now: number) => {
      if (!active || failed || busy || video.seeking || video.readyState < 2 || video.currentTime === lastTime) return;
      busy = true;
      lastSample = now;
      lastTime = video.currentTime;
      try {
        mask ??= await model;
        if (!active) return;
        await mask.update(video);
        if (active && paint()) setStatus('ready');
      } catch {
        if (active) {
          failed = true;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setStatus('error');
        }
      } finally {
        busy = false;
        if (lastTime === -1) void sample(performance.now());
      }
    };

    const schedule = typeof video.requestVideoFrameCallback === 'function'
      ? video.requestVideoFrameCallback.bind(video) : requestAnimationFrame;
    const tick = (now: number) => {
      if (failed) return;
      // Sample the model less often than we composite the live video.
      if (!video.paused) {
        paint();
        if (now - lastSample >= 50) void sample(now);
      }
      frame = schedule(tick);
    };
    const clearFrame = () => {
      lastTime = -1;
      mask?.clear();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!failed) setStatus('loading');
    };
    const updatePausedFrame = () => {
      clearFrame();
      void sample(performance.now());
    };
    const refreshOnPause = () => {
      if (video.currentTime !== lastTime) updatePausedFrame();
    };
    video.addEventListener('loadeddata', updatePausedFrame);
    video.addEventListener('seeking', clearFrame);
    video.addEventListener('seeked', updatePausedFrame);
    video.addEventListener('pause', refreshOnPause);
    void sample(performance.now());
    frame = schedule(tick);
    return () => {
      active = false;
      if (typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(frame);
      else cancelAnimationFrame(frame);
      video.removeEventListener('loadeddata', updatePausedFrame);
      video.removeEventListener('seeking', clearFrame);
      video.removeEventListener('seeked', updatePausedFrame);
      video.removeEventListener('pause', refreshOnPause);
      void model.then(mask => mask.clear()).catch(() => {});
    };
  }, [videoRef, source]);

  return (
    <>
      <canvas ref={canvasRef} className="caption-subject-foreground" data-mask-status={status} aria-hidden="true" />
      {status !== 'ready' && <span className="caption-subject-status" role="status">
        {status === 'loading' ? 'Loading subject mask…' : 'Subject masking is unavailable in this browser.'}
      </span>}
    </>
  );
}
