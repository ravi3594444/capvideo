import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  clampWordSpacing,
  getCaptionWordClock,
  getCaptionBlockMotion,
  getCaptionSpotlightWords,
  getCaptionContainerSpec,
  getCaptionHeadlineIndex,
  getCaptionDisplayRows,
  getDepthRowAppearance,
  getWordVisualSpec,
  isNegativeEmphasisWord,
  normalizeToken,
  resolveEffectiveEffect,
  resolveEffectiveReveal,
  type CaptionCue,
  type StyleConfig,
} from '../utils/captions';

interface CaptionOverlayProps {
  cue: CaptionCue;
  previousCue?: CaptionCue | null;
  currentTime: number;
  config: StyleConfig;
  onEdit?: (cue: CaptionCue) => void;
  fitHeight?: boolean;
}

export function CaptionOverlay({ cue, previousCue, currentTime, config, onEdit, fitHeight = false }: CaptionOverlayProps) {
  const words = cue.text.trim().split(/\s+/).filter(Boolean);
  const contentRef = useRef<HTMLSpanElement>(null);
  const hasWords = words.length > 0;

  useLayoutEffect(() => {
    const content = contentRef.current;
    const frame = content?.parentElement?.parentElement;
    const depth = config.style === 'st-behind-subject';
    if ((!fitHeight && !depth) || !content || !frame) return;
    const safeHeight = config.position === 'pos-third' ? 0.72 : 0.92;
    const fit = () => {
      const available = Math.max(0, frame.clientHeight * safeHeight - 8);
      const width = depth ? Math.max(1, ...Array.from(content.querySelectorAll<HTMLElement>('.cap-row'), row => row.scrollWidth)) : 1;
      const ratio = Math.min(1, available / Math.max(1, content.offsetHeight), frame.clientWidth * 0.88 / width);
      content.style.setProperty('--caption-fit', String(ratio));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    observer.observe(frame);
    if (depth) content.querySelectorAll('.cap-row').forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [config.position, config.style, config.wordsPerPage, cue.text, fitHeight, hasWords]);

  if (!hasWords) return null;

  const { index: activeWordIndex, elapsed: wordElapsedSec, duration: wordDurationSec } = getCaptionWordClock(cue, currentTime, words);
  const revealMode = resolveEffectiveReveal(config);
  const effect = resolveEffectiveEffect(config);
  const container = getCaptionContainerSpec(config.style, effect, config.accentColor);
  const spotlightAuto = config.spotlightAuto ?? true;
  const keywords = getCaptionSpotlightWords(cue, spotlightAuto);
  const headlineIndex = getCaptionHeadlineIndex(cue, words, config.style, effect, spotlightAuto);
  const scaleInLayout = headlineIndex >= 0 || revealMode === 'pop';
  const block = getCaptionBlockMotion(config.style, cue, currentTime, spotlightAuto);
  const rows = getCaptionDisplayRows(config, words, headlineIndex)
    .filter(row => revealMode === 'pop'
      ? row.some(({ index }) => index === activeWordIndex)
      : revealMode !== 'build' || row[0].index <= activeWordIndex);
  const cueElapsedSec = Math.max(0, currentTime - cue.start);
  const cueDurationSec = Math.max(0.2, cue.end - cue.start);
  const Word = onEdit ? 'button' : 'span';

  return (
    <span
      data-testid={onEdit ? 'caption-overlay' : undefined}
      className={`cap-overlay ${config.position} ${config.style}`}
      style={{
        fontSize: `min(calc(${config.fontSize * block.fontScale} * var(--caption-font-unit, 1px)), calc(var(--caption-max-font, 1000px) * ${block.fontScale}))`,
        '--caption-block-scale': block.blockScale,
        '--caption-shift': `${block.shift * 100}%`,
        mixBlendMode: config.blendMode === 'difference' ? 'difference' : undefined,
      } as CSSProperties}
    >
      <span ref={contentRef} className="cap-content">
        {previousCue && config.pageLayout === 'stack' && revealMode !== 'pop' && (
          <span
            className="cap-previous block font-semibold text-white/60 tracking-tight truncate"
            style={{ textShadow: '0 2px 5px rgba(0,0,0,0.85)' }}
          >
            {previousCue.text.trim()}
          </span>
        )}
        <span
          className={`cap-rows ${container.hasFullLineBackdrop ? 'cap-line-backdrop' : ''}`}
          style={{
            '--caption-word-gap': `${clampWordSpacing(config.wordSpacing)}em`,
            backgroundColor: container.backdropColor ?? undefined,
          } as CSSProperties}
        >
          {rows.map((row, rowIndex) => (
            <span key={row[0].index} className="cap-row" data-headline={row[0].index === headlineIndex}
              style={{ fontSize: `${getDepthRowAppearance(config.style, rowIndex, config.accentColor).scale}em` }}>
              {row.map(({ word, index: wordIndex }) => {
                const spec = getWordVisualSpec({
                  style: config.style,
                  fontFamily: config.fontFamily,
                  word,
                  wordIndex,
                  activeWordIndex,
                  accentColor: config.accentColor,
                  revealMode,
                  effect,
                  cueElapsedSec,
                  cueDurationSec,
                  wordElapsedSec,
                  wordDurationSec,
                  isSpotlightKey: keywords.includes(normalizeToken(word)),
                  isHeadlineWord: wordIndex === headlineIndex,
                  isNegative: isNegativeEmphasisWord(word),
                  currentTimeSec: currentTime,
                });
                if (spec.isHidden) return null;

                const transforms: string[] = [];
                if (!scaleInLayout && spec.scale !== 1) transforms.push(`scale(${spec.scale})`);
                if (spec.translateYEm !== 0) transforms.push(`translateY(${spec.translateYEm}em)`);
                if (spec.rotateDeg !== 0) transforms.push(`rotate(${spec.rotateDeg}deg)`);

                let textShadow = spec.shadowMode === 'none' ? 'none' : undefined;
                if (spec.glitchColorShift && spec.glitchDxPx) {
                  const dx = spec.glitchDxPx;
                  textShadow = `${-dx}px 0 rgba(255,45,85,0.8), ${dx}px 0 rgba(34,211,238,0.8)`;
                }

                const style: CSSProperties = {
                  fontFamily: spec.fontCss,
                  fontWeight: spec.fontWeight,
                  fontSize: scaleInLayout ? `${spec.scale}em` : undefined,
                  fontStyle: spec.fontStyle,
                  color: getDepthRowAppearance(config.style, rowIndex, config.accentColor).color ?? spec.color,
                  opacity: spec.opacity,
                  backgroundColor: spec.backgroundColor ?? undefined,
                  marginInline: !scaleInLayout && spec.scale > 1.02 ? `${((spec.scale - 1) * 0.58).toFixed(2)}em` : undefined,
                  transform: transforms.length ? transforms.join(' ') : undefined,
                  textShadow,
                  borderRadius: spec.borderRadiusEm == null ? undefined : `${spec.borderRadiusEm}em`,
                  WebkitTextStroke: spec.outlineColor ? `0.1em ${spec.outlineColor}` : undefined,
                  paintOrder: spec.outlineColor ? 'stroke fill' : undefined,
                };

                return (
                  <Word
                    key={`${cue.id}_${wordIndex}`}
                    {...(onEdit && {
                      type: 'button' as const,
                      onClick: () => onEdit(cue),
                      title: 'Tap to edit text or toggle Spotlight key word',
                    })}
                    style={style}
                    className={`w border-0 ${wordIndex === activeWordIndex ? 'on' : ''}`}
                  >
                    {spec.displayText}
                  </Word>
                );
              })}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
