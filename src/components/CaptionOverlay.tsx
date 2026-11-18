import type { CSSProperties } from 'react';
import {
  clampWordSpacing,
  getActiveWordIndex,
  getCaptionContainerSpec,
  getWordVisualSpec,
  isNegativeEmphasisWord,
  isWordSpotlightKey,
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
}

export function CaptionOverlay({ cue, previousCue, currentTime, config, onEdit }: CaptionOverlayProps) {
  const words = cue.text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const container = getCaptionContainerSpec(config.style);
  const activeWordIndex = getActiveWordIndex(cue, currentTime);
  const revealMode = resolveEffectiveReveal(config);
  const effect = resolveEffectiveEffect(config);
  const spotlightAuto = config.spotlightAuto ?? true;
  const cueElapsedSec = Math.max(0, currentTime - cue.start);
  const cueDurationSec = Math.max(0.2, cue.end - cue.start);
  const Word = onEdit ? 'button' : 'span';

  return (
    <span
      data-testid={onEdit ? 'caption-overlay' : undefined}
      className={`cap-overlay ${config.position} ${config.style}`}
      style={{
        fontSize: `calc(${config.fontSize}px * var(--preview-caption-scale, 1))`,
        mixBlendMode: config.blendMode === 'difference' ? 'difference' : undefined,
      }}
    >
      {previousCue && config.pageLayout === 'stack' && revealMode !== 'pop' && (
        <span
          className="block mb-1 text-[0.76em] font-semibold text-white/60 tracking-tight truncate px-3"
          style={{ textShadow: '0 2px 5px rgba(0,0,0,0.85)' }}
        >
          {previousCue.text.trim()}
        </span>
      )}
      <span
        className={`${container.hasFullLineBackdrop ? 'cap-line-backdrop ' : ''}inline-flex flex-wrap justify-center items-baseline gap-y-[0.14em] max-w-full`}
        style={{
          columnGap: `${clampWordSpacing(config.wordSpacing)}em`,
          backgroundColor: container.backdropColor ?? undefined,
        }}
      >
        {words.map((word, wordIndex) => {
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
            isSpotlightKey: isWordSpotlightKey(word, cue, spotlightAuto),
            isNegative: isNegativeEmphasisWord(word),
            currentTimeSec: currentTime,
          });
          if (spec.isHidden) return null;

          const transforms: string[] = [];
          if (spec.scale !== 1) transforms.push(`scale(${spec.scale})`);
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
            fontStyle: spec.fontStyle,
            color: spec.color,
            opacity: spec.opacity,
            backgroundColor: spec.backgroundColor ?? undefined,
            marginInline: spec.scale > 1.02 ? `${((spec.scale - 1) * 0.58).toFixed(2)}em` : undefined,
            transform: transforms.length ? transforms.join(' ') : undefined,
            textShadow,
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
    </span>
  );
}
