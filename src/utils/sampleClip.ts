export async function generateSampleCreatorClip(): Promise<File> {
  const width = 540;
  const height = 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const stream = canvas.captureStream(24);
  const videoTrack = stream.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  const mime =
    ['video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let frame = 0;
  const totalFrames = 48;
  const draw = () => {
    const p = frame / 72;
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#09090b');
    grad.addColorStop(0.5, '#18181b');
    grad.addColorStop(1, '#09090b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(width * 0.5 + Math.sin(p * Math.PI * 2) * 80, height * 0.36, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Creator Demo Clip', width / 2, height * 0.35);

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '500 18px "Manrope", system-ui, sans-serif';
    ctx.fillText('Test styles, trim & SRT export', width / 2, height * 0.41);

    videoTrack?.requestFrame?.();
    frame++;
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      if (blob.size === 0) {
        reject(new Error('Sample clip recorder produced an empty clip'));
        return;
      }
      resolve(new File([blob], 'creator-demo-clip.webm', { type: 'video/webm' }));
    };
    recorder.onerror = () => reject(new Error('Failed to generate sample clip'));

    draw();
    recorder.start(100);
    const interval = window.setInterval(() => {
      draw();
      const hasData = chunks.length > 0;
      if (frame >= totalFrames && (hasData || frame >= totalFrames + 24)) {
        window.clearInterval(interval);
        if (recorder.state !== 'inactive') {
          try {
            recorder.requestData();
          } catch {
            // ignore if unsupported
          }
          recorder.stop();
        }
      }
    }, 42);
  });
}
