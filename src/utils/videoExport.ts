import {
  clampWordSpacing,
  findActiveCaption,
  findPreviousCaption,
  getActiveWordIndex,
  getCaptionContainerSpec,
  getWordVisualSpec,
  isNegativeEmphasisWord,
  isWordSpotlightKey,
  resolveEffectiveEffect,
  resolveEffectiveReveal,
  type AspectRatio,
  type CaptionCue,
  type StyleConfig,
} from './captions';
import type { AudioGraphHandle, NoiseCleanStrength } from './audioEngine';

export interface ExportOptions {
  video: HTMLVideoElement;
  captions: CaptionCue[];
  aspect: AspectRatio;
  styleConfig: StyleConfig;
  trimStart: number;
  trimEnd: number;
  improveAudio: boolean;
  noiseStrength?: NoiseCleanStrength;
  audioGraph: AudioGraphHandle | null;
  voiceoverBlob?: Blob | null;
  voiceoverEnabled?: boolean;
  replaceOriginalAudio?: boolean;
  onProgress: (percent: number) => void;
}

export async function exportBurnedInWebM(
  opts: ExportOptions
): Promise<{ blob: Blob; usedCleanAudio: boolean; usedAiVoice: boolean }> {
  const {
    video,
    captions,
    aspect,
    styleConfig,
    trimStart,
    trimEnd,
    improveAudio,
    noiseStrength = 'clean',
    audioGraph,
    voiceoverBlob,
    voiceoverEnabled = false,
    replaceOriginalAudio = true,
    onProgress,
  } = opts;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record video via MediaRecorder. Use the .srt export instead.');
  }

  const dims: Record<AspectRatio, [number, number]> = {
    r916: [540, 960],
    r11: [720, 720],
    r169: [960, 540],
  };
  const [width, height] = dims[aspect];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize export canvas.');

  const mime =
    ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
      MediaRecorder.isTypeSupported(m)
    ) || '';

  const streams: MediaStream[] = [canvas.captureStream(30)];
  let usedCleanAudio = false;
  let usedAiVoice = false;
  let voiceCtx: AudioContext | null = null;
  let voiceSource: AudioBufferSourceNode | null = null;
  let voiceBuffer: AudioBuffer | null = null;

  // Prepare AI Voiceover buffer if enabled
  if (voiceoverEnabled && voiceoverBlob) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        voiceCtx = new AudioCtx();
        const ab = await voiceoverBlob.arrayBuffer();
        voiceBuffer = await voiceCtx.decodeAudioData(ab);
        usedAiVoice = true;
      }
    } catch {
      voiceBuffer = null;
      usedAiVoice = false;
    }
  }

  if (improveAudio && audioGraph && !(usedAiVoice && replaceOriginalAudio)) {
    await audioGraph.resumeIfNeeded();
    audioGraph.setImproveEnabled(true, noiseStrength);
    const cleanTracks = audioGraph.destinationStream.getAudioTracks();
    if (cleanTracks.length) {
      usedCleanAudio = true;
      if (!usedAiVoice) {
        streams.push(new MediaStream(cleanTracks));
      }
    }
  }

  // Mix AI voiceover (+ optional video audio) cleanly into one single WebM audio track
  if (usedAiVoice && voiceCtx && voiceBuffer) {
    const mixDest = voiceCtx.createMediaStreamDestination();
    voiceSource = voiceCtx.createBufferSource();
    voiceSource.buffer = voiceBuffer;
    const voiceGain = voiceCtx.createGain();
    voiceGain.gain.value = 1;
    voiceSource.connect(voiceGain);
    voiceGain.connect(mixDest);

    if (!replaceOriginalAudio) {
      try {
        const capVid = video as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };
        const vidStream = usedCleanAudio && audioGraph
          ? audioGraph.destinationStream
          : capVid.captureStream
            ? capVid.captureStream()
            : capVid.mozCaptureStream
              ? capVid.mozCaptureStream()
              : null;
        if (vidStream && vidStream.getAudioTracks().length) {
          const origSrc = voiceCtx.createMediaStreamSource(new MediaStream(vidStream.getAudioTracks()));
          const origGain = voiceCtx.createGain();
          origGain.gain.value = 0.25;
          origSrc.connect(origGain);
          origGain.connect(mixDest);
        }
      } catch {
        // fallback to AI voice track only
      }
    }
    streams.push(mixDest.stream);
  } else if (!usedCleanAudio) {
    try {
      const capVid = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const vs = capVid.captureStream
        ? capVid.captureStream()
        : capVid.mozCaptureStream
          ? capVid.mozCaptureStream()
          : null;
      if (vs) {
        const at = vs.getAudioTracks();
        if (at.length) streams.push(new MediaStream(at));
      }
    } catch {
      // proceed without audio track if browser restricts captureStream
    }
  }

  const combined = new MediaStream();
  streams.forEach((s) => s.getTracks().forEach((t) => combined.addTrack(t)));

  const recorder = new MediaRecorder(
    combined,
    mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : { videoBitsPerSecond: 2500000 }
  );
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const fontPx = Math.round(styleConfig.fontSize * (canvas.width / 340));
  const containerSpec = getCaptionContainerSpec(styleConfig.style);
  const effectiveReveal = resolveEffectiveReveal(styleConfig);
  const effectiveEffect = resolveEffectiveEffect(styleConfig);
  const spotlightAuto = styleConfig.spotlightAuto ?? true;
  const pageLayout = styleConfig.pageLayout ?? 'replace';
  const useDifference = styleConfig.blendMode === 'difference';
  const wordGapPx = fontPx * (clampWordSpacing(styleConfig.wordSpacing) + 0.08);

  const drawFrame = () => {
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const scale = Math.max(canvas.width / vw, canvas.height / vh);
    const w = vw * scale;
    const h = vh * scale;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

    const cue = findActiveCaption(captions, video.currentTime);
    if (cue) {
      const words = cue.text.trim().split(/\s+/).filter(Boolean);
      const on = getActiveWordIndex(cue, video.currentTime);
      const cueElapsed = Math.max(0, video.currentTime - cue.start);
      const cueDuration = Math.max(0.2, cue.end - cue.start);
      ctx.textBaseline = 'middle';

      const prevCue =
        pageLayout === 'stack' && effectiveReveal !== 'pop'
          ? findPreviousCaption(captions, cue)
          : null;

      const wrapSize = styleConfig.wordsPerPage === '2' ? 2 : styleConfig.wordsPerPage === '3' ? 3 : styleConfig.wordsPerPage === '4' ? 4 : 4;
      const lines: { word: string; gi: number }[][] = [];
      if (effectiveReveal === 'pop') {
        if (words[on]) lines.push([{ word: words[on], gi: on }]);
      } else {
        for (let i = 0; i < words.length; i += wrapSize) {
          lines.push(
            words.slice(i, i + wrapSize).map((word, wi) => ({
              word,
              gi: i + wi,
            }))
          );
        }
      }

      const lineHeight = fontPx * 1.38;
      const stackOffset = prevCue ? lineHeight * 0.95 : 0;
      const posY =
        styleConfig.position === 'pos-centre'
          ? canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2
          : styleConfig.position === 'pos-third'
            ? canvas.height * 0.68
            : canvas.height - lines.length * lineHeight - canvas.height * 0.05;

      // Render preceding trailing line faintly above active line when Stack Pages is enabled
      if (prevCue) {
        ctx.save();
        ctx.globalAlpha = 0.56;
        if (useDifference) ctx.globalCompositeOperation = 'difference';
        const prevFontPx = Math.round(fontPx * 0.84);
        ctx.font = `600 ${prevFontPx}px "Manrope", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(prevCue.text.trim(), canvas.width / 2, posY - stackOffset + fontPx * 0.45);
        ctx.restore();
      }

      const lineSpecs = lines.map((line) =>
        line
          .map(({ word, gi }) => {
            const isKey = isWordSpotlightKey(word, cue, spotlightAuto);
            const spec = getWordVisualSpec({
              style: styleConfig.style,
              fontFamily: styleConfig.fontFamily,
              word,
              wordIndex: gi,
              activeWordIndex: on,
              accentColor: styleConfig.accentColor,
              revealMode: effectiveReveal,
              effect: effectiveEffect,
              cueElapsedSec: cueElapsed,
              cueDurationSec: cueDuration,
              isSpotlightKey: isKey,
              isNegative: isNegativeEmphasisWord(word),
              currentTimeSec: video.currentTime,
            });
            if (spec.isHidden) return null;
            const px = Math.round(fontPx * spec.scale);
            ctx.font = `${spec.fontStyle} ${spec.fontWeight} ${px}px ${spec.fontCss}`;
            const widthMeasured = ctx.measureText(spec.displayText).width;
            return { spec, px, widthMeasured };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      );

      if (containerSpec.hasFullLineBackdrop && containerSpec.backdropColor && lineSpecs.some((r) => r.length > 0)) {
        const lineTotals = lineSpecs.map(
          (row) => row.reduce((acc, item) => acc + item.widthMeasured, 0) + Math.max(0, row.length - 1) * wordGapPx
        );
        const maxLineW = Math.max(...lineTotals);
        const padX = fontPx * 0.65;
        const padY = fontPx * 0.38;
        const boxW = maxLineW + padX * 2;
        const boxH = lines.length * lineHeight + padY * 2 - fontPx * 0.2;
        const boxX = (canvas.width - boxW) / 2;
        const boxY = posY - padY + fontPx * 0.1;
        ctx.save();
        ctx.fillStyle = containerSpec.backdropColor;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 12);
        ctx.fill();
        ctx.restore();
      }

      lineSpecs.forEach((row, li) => {
        if (!row.length) return;
        const baseY = posY + li * lineHeight + fontPx / 2;
        const total =
          row.reduce((a, b) => a + b.widthMeasured, 0) +
          Math.max(0, row.length - 1) * wordGapPx;
        let x = (canvas.width - total) / 2;

        row.forEach(({ spec, px, widthMeasured }) => {
          const y = baseY + spec.translateYEm * fontPx;
          ctx.save();
          ctx.globalAlpha = spec.opacity;
          if (useDifference) ctx.globalCompositeOperation = 'difference';
          ctx.font = `${spec.fontStyle} ${spec.fontWeight} ${px}px ${spec.fontCss}`;
          ctx.textAlign = 'left';

          if (spec.rotateDeg !== 0) {
            const cx = x + widthMeasured / 2;
            ctx.translate(cx, y);
            ctx.rotate((spec.rotateDeg * Math.PI) / 180);
            ctx.translate(-cx, -y);
          }

          if (spec.backgroundColor) {
            ctx.fillStyle = spec.backgroundColor;
            ctx.beginPath();
            ctx.roundRect(x - 5, y - px * 0.64, widthMeasured + 10, px * 1.28, 6);
            ctx.fill();
          }

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          if (spec.glitchColorShift && spec.glitchDxPx) {
            ctx.fillStyle = 'rgba(255, 45, 85, 0.72)';
            ctx.fillText(spec.displayText, x - spec.glitchDxPx, y);
            ctx.fillStyle = 'rgba(34, 211, 238, 0.72)';
            ctx.fillText(spec.displayText, x + spec.glitchDxPx, y);
          }

          if (spec.shadowMode === 'soft') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = 7;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
          } else if (spec.shadowMode === 'outline') {
            ctx.lineWidth = Math.max(2, px / 7);
            ctx.strokeStyle = '#000000';
            ctx.lineJoin = 'round';
            ctx.strokeText(spec.displayText, x, y);
          } else if (spec.shadowMode === 'heavy-outline') {
            ctx.lineWidth = Math.max(3, px / 5);
            ctx.strokeStyle = '#000000';
            ctx.lineJoin = 'round';
            ctx.strokeText(spec.displayText, x, y);
          } else if (spec.shadowMode === 'neon') {
            ctx.lineWidth = Math.max(2, px / 7);
            ctx.strokeStyle = '#000000';
            ctx.lineJoin = 'round';
            ctx.strokeText(spec.displayText, x, y);
            ctx.shadowColor = spec.color;
            ctx.shadowBlur = px * 0.55;
            ctx.fillStyle = spec.color;
            ctx.fillText(spec.displayText, x, y);
          }

          ctx.fillStyle = spec.color;
          ctx.fillText(spec.displayText, x, y);
          ctx.restore();

          x += widthMeasured + fontPx * 0.32;
        });
      });
    }

    const len = trimEnd - trimStart;
    onProgress(len > 0 ? Math.min(100, ((video.currentTime - trimStart) / len) * 100) : 0);

    if (!video.paused && !video.ended && video.currentTime < trimEnd) {
      requestAnimationFrame(drawFrame);
    }
  };

  const prevMuted = video.muted;
  if (usedAiVoice && replaceOriginalAudio) {
    video.muted = true;
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.muted = prevMuted;
      try {
        voiceSource?.stop();
      } catch {
        // ignore
      }
      if (voiceCtx) {
        void voiceCtx.close().catch(() => {});
      }
    };

    recorder.onstop = () => {
      video.pause();
      cleanup();
      resolve({
        blob: new Blob(chunks, { type: 'video/webm' }),
        usedCleanAudio,
        usedAiVoice,
      });
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error('Recording failed in browser MediaRecorder.'));
    };

    video.currentTime = trimStart;
    video
      .play()
      .then(async () => {
        if (voiceCtx && voiceSource) {
          if (voiceCtx.state === 'suspended') await voiceCtx.resume();
          voiceSource.start(0, 0);
        }
        recorder.start(250);
        requestAnimationFrame(drawFrame);
        const timer = window.setInterval(() => {
          if (video.currentTime >= trimEnd - 0.1 || video.ended) {
            window.clearInterval(timer);
            if (recorder.state !== 'inactive') recorder.stop();
          }
        }, 200);
      })
      .catch(() => {
        cleanup();
        reject(
          new Error('Could not start playback for export. Tap Play once, then retry export.')
        );
      });
  });
}
