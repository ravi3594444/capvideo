import {
  clampTextHeight,
  clampWordSpacing,
  findActiveCaption,
  findPreviousCaption,
  getCaptionWordClock,
  getCaptionBlockMotion,
  getCaptionSpotlightWords,
  getCaptionContainerSpec,
  getCaptionHeadlineIndex,
  getCaptionDisplayRows,
  getCaptionFit,
  getCaptionPlacement,
  getDepthRowAppearance,
  getWordVisualSpec,
  getWordVerticalPadding,
  isNegativeEmphasisWord,
  normalizeToken,
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

  let foreground: { mask: ReturnType<typeof import('./subjectMask').createSubjectMask>; ctx: CanvasRenderingContext2D } | undefined;
  if (styleConfig.style === 'st-behind-subject') {
    try {
      const { createSubjectMask, loadSubjectMask } = await import('./subjectMask');
      await loadSubjectMask();
      const layer = document.createElement('canvas');
      layer.width = width;
      layer.height = height;
      const layerCtx = layer.getContext('2d');
      if (!layerCtx) throw new Error('Could not initialize subject layer.');
      const mask = createSubjectMask();
      video.pause();
      video.currentTime = trimStart;
      if (video.seeking) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            reject(new Error('Could not seek to the export start.'));
          }, 5000);
          function onSeeked() {
            window.clearTimeout(timeout);
            resolve();
          }
          video.addEventListener('seeked', onSeeked, { once: true });
        });
      }
      await mask.update(video);
      foreground = { mask, ctx: layerCtx };
    } catch {
      throw new Error('Behind Subject could not load its person mask. Try another browser or choose a different caption style.');
    }
  }

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

  const effectiveReveal = resolveEffectiveReveal(styleConfig);
  const effectiveEffect = resolveEffectiveEffect(styleConfig);
  const spotlightAuto = styleConfig.spotlightAuto ?? true;
  const pageLayout = styleConfig.pageLayout ?? 'replace';
  const useDifference = styleConfig.blendMode === 'difference';
  const containerSpec = getCaptionContainerSpec(styleConfig.style, effectiveEffect, styleConfig.accentColor);
  const safeWidth = canvas.width * 0.88;
  const placement = getCaptionPlacement(styleConfig);
  const safeHeight = canvas.height * placement.safeHeight;
  const heightScale = clampTextHeight(styleConfig.textHeight) / 100;

  let maskPending = false;
  let lastMaskTime = -Infinity;
  let animation = 0;
  let timer: number | undefined;
  let failExport: (error: Error) => void;
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
      const block = getCaptionBlockMotion(styleConfig.style, cue, video.currentTime, spotlightAuto);
      const fontPx = Math.round(styleConfig.fontSize * block.fontScale * (canvas.width / 340));
      const backdropPadX = containerSpec.hasFullLineBackdrop ? fontPx * 0.45 : 0;
      const backdropPadY = containerSpec.hasFullLineBackdrop ? fontPx * 0.23 : 0;
      const wordGapPx = fontPx * clampWordSpacing(styleConfig.wordSpacing);
      const lineGap = fontPx * 0.12;
      const words = cue.text.trim().split(/\s+/).filter(Boolean);
      const { index: on, elapsed: wordElapsedSec, duration: wordDurationSec } = getCaptionWordClock(cue, video.currentTime, words);
      const keywords = getCaptionSpotlightWords(cue, spotlightAuto);
      const cueElapsed = Math.max(0, video.currentTime - cue.start);
      const cueDuration = Math.max(0.2, cue.end - cue.start);
      ctx.textBaseline = 'middle';

      const prevCue =
        pageLayout === 'stack' && effectiveReveal !== 'pop'
          ? findPreviousCaption(captions, cue)
          : null;

      const headlineIndex = getCaptionHeadlineIndex(cue, words, styleConfig.style, effectiveEffect, spotlightAuto);
      const lines = effectiveReveal === 'pop'
        ? words[on] ? [[{ word: words[on], index: on }]] : []
        : getCaptionDisplayRows(styleConfig, words, headlineIndex);

      const lineSpecs = lines.map((line, rowIndex) =>
        line
          .map(({ word, index: gi }) => {
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
              wordElapsedSec,
              wordDurationSec,
              isSpotlightKey: keywords.includes(normalizeToken(word)),
              isHeadlineWord: gi === headlineIndex,
              isNegative: isNegativeEmphasisWord(word),
              currentTimeSec: video.currentTime,
            });
            if (spec.isHidden) return null;
            const depth = getDepthRowAppearance(styleConfig.style, rowIndex, styleConfig.accentColor);
            spec.color = depth.color ?? spec.color;
            const px = Math.round(fontPx * spec.scale * depth.scale);
            ctx.font = `${spec.fontStyle} ${spec.fontWeight} ${px}px ${spec.fontCss}`;
            const textWidth = ctx.measureText(spec.displayText).width;
            const padding = px * 0.12;
            const width = textWidth + padding * 2;
            const spacing = getWordVerticalPadding(width, px * 1.24, 1, spec.translateYEm * fontPx, spec.rotateDeg);
            return { spec, px, textWidth, padding, width, above: px * .62 + spacing.above, below: px * .62 + spacing.below };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      );

      const availableWidth = safeWidth - backdropPadX * 2;
      const rows = lineSpecs.flatMap(words => {
        const wrapped: { words: typeof words; width: number; above: number; below: number }[] = [];
        for (const word of words) {
          let row = wrapped[wrapped.length - 1];
          if (!row || (!foreground && row.width + wordGapPx + word.width > availableWidth)) {
            row = { words: [], width: 0, above: 0, below: 0 };
            wrapped.push(row);
          }
          row.width += (row.words.length ? wordGapPx : 0) + word.width;
          row.above = Math.max(row.above, word.above);
          row.below = Math.max(row.below, word.below);
          row.words.push(word);
        }
        return wrapped;
      });

      const boxWidth = Math.max(0, ...rows.map(row => row.width)) + backdropPadX * 2;
      const rowsHeight = rows.reduce((height, row) => height + row.above + row.below, 0) + lineGap * Math.max(0, rows.length - 1);
      const previousHeight = prevCue ? fontPx * 1.12 : 0;
      const blockHeight = previousHeight + rowsHeight + backdropPadY * 2;
      const fit = getCaptionFit(boxWidth, blockHeight, safeWidth, safeHeight, heightScale);
      const scaleX = fit.x * block.blockScale;
      const scaleY = fit.y * block.blockScale;
      const top = canvas.height * placement.anchor - blockHeight * scaleY * placement.origin;

      ctx.save();
      ctx.translate(canvas.width * (0.5 + block.shift), top);
      ctx.scale(scaleX, scaleY);

      if (prevCue) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        if (useDifference) ctx.globalCompositeOperation = 'difference';
        ctx.font = `600 ${fontPx * 0.76}px "Manrope", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(prevCue.text.trim(), 0, previousHeight / 2, safeWidth / scaleX);
        ctx.restore();
      }

      if (rows.length && containerSpec.backdropColor) {
        ctx.fillStyle = containerSpec.backdropColor;
        ctx.beginPath();
        ctx.roundRect(-boxWidth / 2, previousHeight, boxWidth, rowsHeight + backdropPadY * 2, fontPx * 0.32);
        ctx.fill();
      }

      let rowTop = previousHeight + backdropPadY;
      for (const row of rows) {
        let cursor = -row.width / 2;
        for (const { spec, px, textWidth, padding, width } of row.words) {
          const x = cursor + padding;
          const y = rowTop + row.above + spec.translateYEm * fontPx;
          ctx.save();
          ctx.globalAlpha = spec.opacity;
          if (useDifference) ctx.globalCompositeOperation = 'difference';
          ctx.font = `${spec.fontStyle} ${spec.fontWeight} ${px}px ${spec.fontCss}`;
          ctx.textAlign = 'left';

          if (spec.rotateDeg !== 0) {
            const cx = x + textWidth / 2;
            ctx.translate(cx, y);
            ctx.rotate((spec.rotateDeg * Math.PI) / 180);
            ctx.translate(-cx, -y);
          }

          if (spec.backgroundColor) {
            ctx.fillStyle = spec.backgroundColor;
            ctx.beginPath();
            ctx.roundRect(cursor, y - px * 0.61, width, px * 1.22, px * (spec.borderRadiusEm ?? 0.22));
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
            ctx.lineWidth = Math.max(2, px * 0.095);
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

          if (spec.outlineColor) {
            ctx.lineWidth = px * 0.1;
            ctx.strokeStyle = spec.outlineColor;
            ctx.lineJoin = 'round';
            ctx.strokeText(spec.displayText, x, y);
          }

          ctx.fillStyle = spec.color;
          ctx.fillText(spec.displayText, x, y);
          ctx.restore();

          cursor += width + wordGapPx;
        }
        rowTop += row.above + row.below + lineGap;
      }
      ctx.restore();
    }

    if (foreground) {
      const { mask, ctx: foregroundCtx } = foreground;
      const frameTime = video.currentTime;
      if (!maskPending && Math.abs(frameTime - lastMaskTime) >= 0.05) {
        lastMaskTime = frameTime;
        maskPending = true;
        void mask.update(video).catch(() => {
          failExport(new Error('Person masking failed during export. Try another browser or caption style.'));
        }).finally(() => { maskPending = false; });
      }
      if (cue && mask.drawForeground(foregroundCtx, video, width, height)) {
        ctx.drawImage(foregroundCtx.canvas, 0, 0);
      }
    }

    const len = trimEnd - trimStart;
    onProgress(len > 0 ? Math.min(100, ((video.currentTime - trimStart) / len) * 100) : 0);

    if (!video.paused && !video.ended && video.currentTime < trimEnd) {
      animation = requestAnimationFrame(drawFrame);
    }
  };

  const prevMuted = video.muted;
  if (usedAiVoice && replaceOriginalAudio) {
    video.muted = true;
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      cancelAnimationFrame(animation);
      window.clearInterval(timer);
      foreground?.mask.clear();
      streams[0].getVideoTracks().forEach(track => track.stop());
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
    failExport = (error) => {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      video.pause();
      cleanup();
      reject(error);
    };
    recorder.onerror = () => failExport(new Error('Recording failed in browser MediaRecorder.'));

    if (!foreground) video.currentTime = trimStart;
    video
      .play()
      .then(async () => {
        if (voiceCtx && voiceSource) {
          if (voiceCtx.state === 'suspended') await voiceCtx.resume();
          voiceSource.start(0, 0);
        }
        recorder.start(250);
        animation = requestAnimationFrame(drawFrame);
        timer = window.setInterval(() => {
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
