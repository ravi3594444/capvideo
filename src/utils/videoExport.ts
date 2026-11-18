import {
  clampWordSpacing,
  findActiveCaption,
  findPreviousCaption,
  getCaptionWordClock,
  getCaptionSpotlightWords,
  getCaptionContainerSpec,
  getCaptionHeadlineIndex,
  getCaptionWordRows,
  getWordVisualSpec,
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
  const effectiveReveal = resolveEffectiveReveal(styleConfig);
  const effectiveEffect = resolveEffectiveEffect(styleConfig);
  const spotlightAuto = styleConfig.spotlightAuto ?? true;
  const pageLayout = styleConfig.pageLayout ?? 'replace';
  const useDifference = styleConfig.blendMode === 'difference';
  const containerSpec = getCaptionContainerSpec(styleConfig.style, effectiveEffect, styleConfig.accentColor);
  const wordGapPx = fontPx * clampWordSpacing(styleConfig.wordSpacing);
  const lineGap = fontPx * 0.12;
  const backdropPadX = containerSpec.hasFullLineBackdrop ? fontPx * 0.45 : 0;
  const backdropPadY = containerSpec.hasFullLineBackdrop ? fontPx * 0.23 : 0;
  const safeWidth = canvas.width * 0.88;
  const bottomInset = styleConfig.position === 'pos-third' ? 0.26 : 0.06;
  const safeHeight = canvas.height * (styleConfig.position === 'pos-third' ? 0.71 : 0.92);

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
      const { index: on, elapsed: wordElapsedSec, duration: wordDurationSec } = getCaptionWordClock(cue, video.currentTime, words);
      const keywords = getCaptionSpotlightWords(cue, spotlightAuto);
      const cueElapsed = Math.max(0, video.currentTime - cue.start);
      const cueDuration = Math.max(0.2, cue.end - cue.start);
      ctx.textBaseline = 'middle';

      const prevCue =
        pageLayout === 'stack' && effectiveReveal !== 'pop'
          ? findPreviousCaption(captions, cue)
          : null;

      const wrapSize = Number(styleConfig.wordsPerPage) || 4;
      const headlineIndex = getCaptionHeadlineIndex(cue, words, styleConfig.style, effectiveEffect, spotlightAuto);
      const lines = effectiveReveal === 'pop'
        ? words[on] ? [[{ word: words[on], index: on }]] : []
        : getCaptionWordRows(words, headlineIndex, wrapSize);

      const lineSpecs = lines.map((line) =>
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
            const px = Math.round(fontPx * spec.scale);
            ctx.font = `${spec.fontStyle} ${spec.fontWeight} ${px}px ${spec.fontCss}`;
            const textWidth = ctx.measureText(spec.displayText).width;
            const padding = px * 0.12;
            return { spec, px, textWidth, padding, width: textWidth + padding * 2 };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      );

      const availableWidth = safeWidth - backdropPadX * 2;
      const rows = lineSpecs.flatMap(words => {
        const wrapped: { words: typeof words; width: number; height: number }[] = [];
        for (const word of words) {
          let row = wrapped[wrapped.length - 1];
          if (!row || row.width + wordGapPx + word.width > availableWidth) {
            row = { words: [], width: 0, height: 0 };
            wrapped.push(row);
          }
          row.width += (row.words.length ? wordGapPx : 0) + word.width;
          row.height = Math.max(row.height, word.px * 1.24);
          row.words.push(word);
        }
        return wrapped;
      });

      const boxWidth = Math.max(0, ...rows.map(row => row.width)) + backdropPadX * 2;
      const rowsHeight = rows.reduce((height, row) => height + row.height, 0) + lineGap * Math.max(0, rows.length - 1);
      const previousHeight = prevCue ? fontPx * 1.12 : 0;
      const blockHeight = previousHeight + rowsHeight + backdropPadY * 2;
      const fit = rows.length ? Math.min(1, safeWidth / Math.max(1, boxWidth), safeHeight / Math.max(1, blockHeight)) : 1;
      const top = styleConfig.position === 'pos-centre'
        ? (canvas.height - blockHeight * fit) / 2
        : canvas.height * (1 - bottomInset) - blockHeight * fit;

      ctx.save();
      ctx.translate(canvas.width / 2, top);
      ctx.scale(fit, fit);

      if (prevCue) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        if (useDifference) ctx.globalCompositeOperation = 'difference';
        ctx.font = `600 ${fontPx * 0.76}px "Manrope", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(prevCue.text.trim(), 0, previousHeight / 2, safeWidth / fit);
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
          const y = rowTop + row.height / 2 + spec.translateYEm * fontPx;
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
        rowTop += row.height + lineGap;
      }
      ctx.restore();
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
