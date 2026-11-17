import { useEffect, useState } from 'react';
import { BookmarkPlus, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  CAPTION_FONT_OPTIONS,
  CAPTION_STYLE_CATALOG,
  clampWordSpacing,
  CURATED_PRESET_PACKS,
  ENTRANCE_EFFECT_OPTIONS,
  getCaptionContainerSpec,
  getWordVisualSpec,
  isNegativeEmphasisWord,
  isWordSpotlightKey,
  REVEAL_MODE_OPTIONS,
  resolveEffectiveEffect,
  resolveEffectiveReveal,
  type CaptionBlendMode,
  type CaptionCue,
  type CaptionFont,
  type CaptionPosition,
  type CaptionStyleCategory,
  type EntranceEffect,
  type PageLayoutMode,
  type RevealMode,
  type StyleConfig,
} from '../utils/captions';
import type { CloudStylePreset } from '../lib/firestoreService';

interface StylePanelProps {
  styleConfig: StyleConfig;
  previewConfig: StyleConfig | null;
  previewLabel: string | null;
  sampleCue: CaptionCue | null;
  presets: CloudStylePreset[];
  signedIn: boolean;
  onChange: (next: StyleConfig) => void;
  onPreviewChange: (next: StyleConfig | null, label?: string) => void;
  onSavePreset: (name: string) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
  onSignInPrompt: () => void;
}

const CATEGORY_GROUPS: { key: CaptionStyleCategory; title: string; subtitle: string }[] = [
  {
    key: 'simple',
    title: 'Simple & clean (no heavy boxes)',
    subtitle: 'Normal subtitles, clean readable typography, zero or subtle cinema bar',
  },
  {
    key: 'font-switch',
    title: 'Dynamic font-switch (changes on the spoken beat)',
    subtitle: 'Font face, slant, or display weight shifts at the exact moment each word plays',
  },
  {
    key: 'creator',
    title: 'Bold creator highlights',
    subtitle: 'High-retention Reels, Shorts, and TikTok styles with scale, bounce, and glow',
  },
];

const POSITION_OPTIONS: { value: CaptionPosition; label: string }[] = [
  { value: 'pos-bottom', label: 'Bottom' },
  { value: 'pos-third', label: 'Lower third' },
  { value: 'pos-centre', label: 'Centre' },
];

const FALLBACK_PREVIEW_CUE: CaptionCue = {
  id: 'preview_demo',
  start: 0,
  end: 2.0,
  text: 'Stop scrolling right now',
};

function renderStyleSpecimen(styleId: string, accent: string, baseFontCss: string) {
  switch (styleId) {
    case 'st-minimal':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 600 }} className="text-white/95">
          clean <span className="text-white">words</span>
        </span>
      );
    case 'st-editorial':
      return (
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 700 }} className="text-white">
          quiet <span className="italic" style={{ color: accent }}>style</span>
        </span>
      );
    case 'st-cinema':
      return (
        <span
          style={{ fontFamily: baseFontCss, fontWeight: 600 }}
          className="inline-block rounded px-1.5 py-0.5 bg-zinc-950/90 text-zinc-200 border border-white/10"
        >
          story <span className="text-white font-bold">line</span>
        </span>
      );
    case 'st-classic':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 800 }} className="text-white">
          say{' '}
          <span className="rounded px-1 text-zinc-950" style={{ backgroundColor: '#fde047' }}>
            this
          </span>
        </span>
      );
    case 'st-font-switch':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 600 }} className="text-white">
          say{' '}
          <span
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 700,
              color: accent,
            }}
          >
            this
          </span>
        </span>
      );
    case 'st-font-snap':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 500 }} className="text-zinc-200">
          hit{' '}
          <span
            style={{
              fontFamily: '"Oswald", Impact, sans-serif',
              fontWeight: 700,
              color: accent,
            }}
          >
            NOW
          </span>
        </span>
      );
    case 'st-kinetic-mix':
      return (
        <span className="text-white" style={{ fontFamily: baseFontCss, fontWeight: 600 }}>
          <span
            className="italic"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', color: accent }}
          >
            mix
          </span>{' '}
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>BEAT</span>
        </span>
      );
    case 'st-typewriter':
      return (
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }} className="text-white">
          type{' '}
          <span className="px-1 rounded bg-white/15" style={{ color: accent }}>
            now
          </span>
        </span>
      );
    case 'st-hormozi':
      return (
        <span style={{ fontFamily: '"Oswald", Impact, sans-serif', fontWeight: 700 }} className="tracking-wide text-white">
          STOP <span style={{ color: accent }}>SCROLL</span>
        </span>
      );
    case 'st-highlight':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 800 }} className="text-white">
          pop{' '}
          <span className="rounded px-1 text-zinc-950" style={{ backgroundColor: '#fde047' }}>
            word
          </span>
        </span>
      );
    case 'st-pop':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 800 }} className="text-white">
          <span className="inline-block scale-110" style={{ color: accent }}>
            ONE
          </span>
        </span>
      );
    case 'st-cycle':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 800 }}>
          <span className="text-[#ffd60a]">hue</span>{' '}
          <span className="text-[#22d3ee]">shift</span>
        </span>
      );
    case 'st-karaoke':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 800 }}>
          <span className="text-[#a3e635]">sing</span>{' '}
          <span className="rounded px-1 text-zinc-950" style={{ backgroundColor: accent }}>
            now
          </span>
        </span>
      );
    case 'st-bounce':
      return (
        <span style={{ fontFamily: baseFontCss, fontWeight: 800 }} className="text-white">
          up{' '}
          <span className="inline-block -rotate-3" style={{ color: accent }}>
            jump
          </span>
        </span>
      );
    case 'st-neon':
    default:
      return (
        <span
          style={{ fontFamily: baseFontCss, fontWeight: 800, textShadow: `0 0 8px ${accent}` }}
          className="text-white"
        >
          glow <span style={{ color: '#22d3ee' }}>mode</span>
        </span>
      );
  }
}

export function StylePanel({
  styleConfig,
  previewConfig,
  previewLabel,
  sampleCue,
  presets,
  signedIn,
  onChange,
  onPreviewChange,
  onSavePreset,
  onDeletePreset,
  onSignInPrompt,
}: StylePanelProps) {
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetMsg, setPresetMsg] = useState('');
  const [animating, setAnimating] = useState(true);
  const [loopElapsedSec, setLoopElapsedSec] = useState(0.45);

  const displayedConfig = previewConfig ?? styleConfig;
  const activeFontMeta =
    CAPTION_FONT_OPTIONS.find((f) => f.id === displayedConfig.fontFamily) ?? CAPTION_FONT_OPTIONS[0];
  const effectiveReveal = resolveEffectiveReveal(displayedConfig);
  const effectiveEffect = resolveEffectiveEffect(displayedConfig);
  const pageLayout: PageLayoutMode = displayedConfig.pageLayout ?? 'replace';
  const blendMode: CaptionBlendMode = displayedConfig.blendMode ?? 'normal';
  const spotlightAuto = displayedConfig.spotlightAuto ?? true;
  const wordSpacingEm = clampWordSpacing(displayedConfig.wordSpacing);

  useEffect(() => {
    if (!animating) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setLoopElapsedSec((prev) => {
        const next = prev + 0.06;
        return next >= 2.0 ? 0.02 : next;
      });
    }, 60);
    return () => window.clearInterval(timer);
  }, [animating]);

  const cueForPreview = sampleCue && sampleCue.text.trim() ? sampleCue : FALLBACK_PREVIEW_CUE;
  const previewWords = cueForPreview.text.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const activeWordIdx =
    previewWords.length > 0
      ? Math.min(previewWords.length - 1, Math.floor((loopElapsedSec / 2.0) * previewWords.length))
      : 0;
  const previewContainerSpec = getCaptionContainerSpec(displayedConfig.style);
  const activeStyleMeta =
    CAPTION_STYLE_CATALOG.find((s) => s.id === displayedConfig.style) ?? CAPTION_STYLE_CATALOG[0];

  const spinStyle = (dir: -1 | 1) => {
    const idx = CAPTION_STYLE_CATALOG.findIndex((s) => s.id === styleConfig.style);
    const nextIdx = (idx + dir + CAPTION_STYLE_CATALOG.length) % CAPTION_STYLE_CATALOG.length;
    const chosen = CAPTION_STYLE_CATALOG[nextIdx];
    onPreviewChange(null);
    onChange({
      ...styleConfig,
      style: chosen.id,
      revealMode: chosen.defaultReveal,
      effect: chosen.defaultEffect,
      ...(chosen.defaultFont ? { fontFamily: chosen.defaultFont } : {}),
    });
  };

  const handleSave = async () => {
    if (!signedIn) {
      onSignInPrompt();
      return;
    }
    const clean = presetName.trim() || 'Creator Look';
    setSavingPreset(true);
    setPresetMsg('');
    try {
      await onSavePreset(clean);
      setPresetName('');
      setPresetMsg(`Saved preset “${clean}” to your Firebase account.`);
    } catch (err) {
      setPresetMsg(err instanceof Error ? err.message : 'Failed to save preset.');
    } finally {
      setSavingPreset(false);
    }
  };

  return (
    <div className="space-y-5 @container/style">
      {/* Live Motion Audition Strip — always shows how styles/effects move BEFORE applying */}
      <div
        data-testid="live-style-preview"
        className="rounded-xl border border-border/90 bg-zinc-950 p-3.5 space-y-2.5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-semibold text-white truncate">
              {previewLabel ? `Previewing: ${previewLabel}` : `Applied: ${activeStyleMeta.label}`}
            </span>
            <span className="text-zinc-400 hidden sm:inline">
              {previewLabel ? '· Click card to apply' : '· Hover any card or effect below to audition'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setAnimating((a) => !a)}
              aria-label={animating ? 'Pause motion preview' : 'Play motion preview'}
              className="text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer h-6 px-2"
            >
              {animating ? (
                <>
                  <Pause className="w-3 h-3" aria-hidden="true" />
                  <span>Freeze</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" aria-hidden="true" />
                  <span>Animate</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div
          className="relative min-h-[68px] rounded-lg border border-white/10 px-4 py-3 flex items-center justify-center overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), rgba(9,9,11,0.96) 75%)',
          }}
        >
          <div
            className={`text-center leading-tight ${displayedConfig.style}`}
            style={{
              fontSize: `${Math.min(24, Math.max(16, Math.round(displayedConfig.fontSize * 0.88)))}px`,
              mixBlendMode: blendMode === 'difference' ? 'difference' : undefined,
            }}
          >
            {(() => {
              const wordNodes = previewWords
                .map((word, idx) => {
                  const isOn = idx === activeWordIdx;
                  const isKey = isWordSpotlightKey(word, cueForPreview, spotlightAuto);
                  const spec = getWordVisualSpec({
                    style: displayedConfig.style,
                    fontFamily: displayedConfig.fontFamily,
                    word,
                    wordIndex: idx,
                    activeWordIndex: activeWordIdx,
                    accentColor: displayedConfig.accentColor,
                    revealMode: effectiveReveal,
                    effect: effectiveEffect,
                    cueElapsedSec: loopElapsedSec,
                    cueDurationSec: 2.0,
                    isSpotlightKey: isKey,
                    isNegative: isNegativeEmphasisWord(word),
                    currentTimeSec: loopElapsedSec,
                  });
                  if (spec.isHidden) return null;

                  const transforms: string[] = [];
                  if (spec.scale !== 1) transforms.push(`scale(${spec.scale})`);
                  if (spec.translateYEm !== 0) transforms.push(`translateY(${spec.translateYEm}em)`);
                  if (spec.rotateDeg !== 0) transforms.push(`rotate(${spec.rotateDeg}deg)`);

                  let customShadow = spec.shadowMode === 'none' ? 'none' : undefined;
                  if (spec.glitchColorShift && spec.glitchDxPx) {
                    const dx = spec.glitchDxPx;
                    customShadow = `${-dx}px 0 rgba(255,45,85,0.8), ${dx}px 0 rgba(34,211,238,0.8)`;
                  }

                  return (
                    <span
                      key={`live_${idx}`}
                      style={{
                        display: 'inline-block',
                        padding: '2px 3px',
                        borderRadius: '5px',
                        fontFamily: spec.fontCss,
                        fontWeight: spec.fontWeight,
                        fontStyle: spec.fontStyle,
                        color: spec.color,
                        opacity: spec.opacity,
                        backgroundColor: spec.backgroundColor ?? undefined,
                        marginInline:
                          spec.scale > 1.02 ? `${((spec.scale - 1) * 0.58).toFixed(2)}em` : undefined,
                        transform: transforms.length ? transforms.join(' ') : undefined,
                        textShadow: customShadow,
                      }}
                    >
                      {spec.displayText}
                    </span>
                  );
                })
                .filter(Boolean);

              if (previewContainerSpec.hasFullLineBackdrop) {
                return (
                  <span
                    className="inline-flex flex-wrap justify-center items-baseline gap-y-[0.12em] rounded-lg px-3 py-1.5"
                    style={{
                      columnGap: `${wordSpacingEm}em`,
                      backgroundColor: previewContainerSpec.backdropColor ?? undefined,
                    }}
                  >
                    {wordNodes}
                  </span>
                );
              }
              return (
                <div
                  className="inline-flex flex-wrap justify-center items-baseline gap-y-[0.12em]"
                  style={{ columnGap: `${wordSpacingEm}em` }}
                >
                  {wordNodes}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Flagship VideoCaptions.ai Curated Preset Packs with Hover Audition */}
      <div className="space-y-2.5" onMouseLeave={() => onPreviewChange(null)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>Curated signature combinations</span>
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Hover any card to audition live on your video before applying.
            </p>
          </div>
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => spinStyle(-1)}
              aria-label="Previous caption style"
              className="cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Spin</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => spinStyle(1)}
              aria-label="Next caption style"
              className="cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 @sm/style:grid-cols-2 @md/style:grid-cols-3 gap-2">
          {CURATED_PRESET_PACKS.map((pack) => {
            const isActive =
              styleConfig.style === pack.apply.style &&
              resolveEffectiveReveal(styleConfig) === (pack.apply.revealMode ?? resolveEffectiveReveal(styleConfig)) &&
              resolveEffectiveEffect(styleConfig) === (pack.apply.effect ?? resolveEffectiveEffect(styleConfig)) &&
              (styleConfig.blendMode ?? 'normal') === (pack.apply.blendMode ?? 'normal');
            const candidate = { ...styleConfig, ...pack.apply };
            return (
              <button
                key={pack.id}
                type="button"
                aria-pressed={isActive}
                onMouseEnter={() => onPreviewChange(candidate, pack.label)}
                onFocus={() => onPreviewChange(candidate, pack.label)}
                onBlur={() => onPreviewChange(null)}
                onClick={() => {
                  onPreviewChange(null);
                  onChange(candidate);
                }}
                className={`px-3 py-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
                  isActive
                    ? 'border-primary bg-accent/70 text-foreground'
                    : 'border-border/70 glass-subpanel hover:bg-card/85 hover:border-white/35 text-foreground'
                }`}
              >
                <div className="text-xs font-bold">{pack.label}</div>
                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {pack.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Two-Axis Customizer: Visible Interactive Chips with Hover Audition */}
      <div className="rounded-xl glass-subpanel p-3.5 space-y-4" onMouseLeave={() => onPreviewChange(null)}>
        <div>
          <h3 className="font-heading text-xs font-bold text-foreground">
            Reveal Category &amp; Entrance Animation
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Hover any reveal mode or entrance effect to watch how it animates before you apply.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Reveal category</Label>
          <div role="group" aria-label="Reveal category" className="flex flex-wrap gap-1.5">
            {REVEAL_MODE_OPTIONS.map((opt) => {
              const active = resolveEffectiveReveal(styleConfig) === opt.id;
              const candidate = { ...styleConfig, revealMode: opt.id };
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  title={opt.desc}
                  onMouseEnter={() => onPreviewChange(candidate, `Reveal: ${opt.label}`)}
                  onFocus={() => onPreviewChange(candidate, `Reveal: ${opt.label}`)}
                  onBlur={() => onPreviewChange(null)}
                  onClick={() => {
                    onPreviewChange(null);
                    onChange(candidate);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background/55 text-muted-foreground border-border/80 hover:text-foreground hover:border-white/35'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Entrance effect</Label>
          <div role="group" aria-label="Entrance effect" className="flex flex-wrap gap-1.5">
            {ENTRANCE_EFFECT_OPTIONS.map((opt) => {
              const active = resolveEffectiveEffect(styleConfig) === opt.id;
              const candidate = { ...styleConfig, effect: opt.id };
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onMouseEnter={() => onPreviewChange(candidate, `Effect: ${opt.label}`)}
                  onFocus={() => onPreviewChange(candidate, `Effect: ${opt.label}`)}
                  onBlur={() => onPreviewChange(null)}
                  onClick={() => {
                    onPreviewChange(null);
                    onChange(candidate);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background/55 text-muted-foreground border-border/80 hover:text-foreground hover:border-white/35'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 @sm/style:grid-cols-3 gap-3 pt-1">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/50 px-2.5 py-2">
            <Label htmlFor="spotlight-auto-switch" className="text-xs font-medium cursor-pointer">
              Auto Spotlight
            </Label>
            <Switch
              id="spotlight-auto-switch"
              checked={styleConfig.spotlightAuto ?? true}
              onCheckedChange={(checked) =>
                onChange({ ...styleConfig, spotlightAuto: Boolean(checked) })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/50 px-2.5 py-2">
            <span className="text-xs font-medium text-foreground">Pages</span>
            <div className="inline-flex items-center gap-0.5 rounded bg-muted p-0.5">
              {(['replace', 'stack'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={(styleConfig.pageLayout ?? 'replace') === mode}
                  onClick={() => onChange({ ...styleConfig, pageLayout: mode })}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer capitalize whitespace-nowrap ${
                    (styleConfig.pageLayout ?? 'replace') === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/50 px-2.5 py-2">
            <span className="text-xs font-medium text-foreground">Blend</span>
            <div className="inline-flex items-center gap-0.5 rounded bg-muted p-0.5">
              {(['normal', 'difference'] as const).map((bm) => (
                <button
                  key={bm}
                  type="button"
                  aria-pressed={(styleConfig.blendMode ?? 'normal') === bm}
                  onMouseEnter={() =>
                    onPreviewChange(
                      { ...styleConfig, blendMode: bm },
                      bm === 'difference' ? 'Difference Invert' : 'Standard Blend'
                    )
                  }
                  onClick={() => {
                    onPreviewChange(null);
                    onChange({ ...styleConfig, blendMode: bm });
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer capitalize whitespace-nowrap ${
                    (styleConfig.blendMode ?? 'normal') === bm
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {bm === 'normal' ? 'Std' : 'Invert'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Text Size & Adjustable Word Spacing */}
      <div className="grid grid-cols-1 @md/style:grid-cols-2 gap-4 rounded-xl glass-subpanel p-3.5">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <Label htmlFor="caption-font-size">Text size</Label>
            <span className="font-mono text-muted-foreground tabular-nums">
              {styleConfig.fontSize}px
            </span>
          </div>
          <Slider
            id="caption-font-size"
            aria-label="Text size"
            min={14}
            max={38}
            step={1}
            value={[styleConfig.fontSize]}
            onValueChange={(val) => {
              const next = Array.isArray(val) ? val[0] : val;
              if (typeof next === 'number') {
                onChange({ ...styleConfig, fontSize: next });
              }
            }}
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <Label htmlFor="caption-word-spacing">Word spacing</Label>
            <div className="flex items-center gap-2">
              {clampWordSpacing(styleConfig.wordSpacing) !== 0.26 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...styleConfig, wordSpacing: 0.26 })}
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 cursor-pointer"
                  title="Reset word spacing to default (0.26em)"
                >
                  <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
              <span className="font-mono text-muted-foreground tabular-nums">
                {clampWordSpacing(styleConfig.wordSpacing).toFixed(2)}em
              </span>
            </div>
          </div>
          <Slider
            id="caption-word-spacing"
            aria-label="Word spacing"
            min={0.06}
            max={0.9}
            step={0.02}
            value={[clampWordSpacing(styleConfig.wordSpacing)]}
            onValueChange={(val) => {
              const next = Array.isArray(val) ? val[0] : val;
              if (typeof next === 'number') {
                onChange({ ...styleConfig, wordSpacing: clampWordSpacing(next) });
              }
            }}
          />
        </div>
      </div>

      {/* 15 Visual Style Looks with Hover Audition */}
      <div className="space-y-4" onMouseLeave={() => onPreviewChange(null)}>
        {CATEGORY_GROUPS.map((group) => {
          const items = CAPTION_STYLE_CATALOG.filter((s) => s.category === group.key);
          return (
            <div key={group.key} className="space-y-2">
              <div>
                <Label className="text-xs font-bold text-foreground">{group.title}</Label>
                <p className="text-[11px] text-muted-foreground">{group.subtitle}</p>
              </div>
              <div
                role="group"
                aria-label={group.title}
                className="grid grid-cols-1 @sm/style:grid-cols-2 gap-2"
              >
                {items.map((opt) => {
                  const active = styleConfig.style === opt.id;
                  const candidate: StyleConfig = {
                    ...styleConfig,
                    style: opt.id,
                    revealMode: opt.defaultReveal,
                    effect: opt.defaultEffect,
                    ...(opt.defaultFont ? { fontFamily: opt.defaultFont } : {}),
                  };
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onMouseEnter={() => onPreviewChange(candidate, opt.label)}
                      onFocus={() => onPreviewChange(candidate, opt.label)}
                      onBlur={() => onPreviewChange(null)}
                      onClick={() => {
                        onPreviewChange(null);
                        onChange(candidate);
                      }}
                      className={`min-h-[54px] px-3 py-2.5 rounded-xl text-left border backdrop-blur-md transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? 'border-primary bg-accent/70 text-foreground shadow-xs'
                          : 'border-border/70 glass-subpanel hover:bg-card/85 hover:border-white/35 text-foreground'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{opt.label}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                          {opt.desc}
                        </div>
                      </div>
                      <div
                        className="shrink-0 rounded-md bg-zinc-950/90 border border-white/10 px-2 py-1 text-[11px] leading-none"
                        aria-hidden="true"
                      >
                        {renderStyleSpecimen(opt.id, displayedConfig.accentColor, activeFontMeta.cssFamily)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      <div className="grid grid-cols-1 @md/style:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="caption-font-trigger" className="text-xs font-semibold">
            Caption base font
          </Label>
          <Select
            value={styleConfig.fontFamily}
            onValueChange={(val) => {
              if (val) onChange({ ...styleConfig, fontFamily: val as CaptionFont });
            }}
          >
            <SelectTrigger id="caption-font-trigger" className="w-full h-9 bg-background">
              <SelectValue>{activeFontMeta.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CAPTION_FONT_OPTIONS.map((font) => (
                <SelectItem key={font.id} value={font.id}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caption-position-trigger" className="text-xs font-semibold">
            Vertical position
          </Label>
          <Select
            value={styleConfig.position}
            onValueChange={(val) => {
              if (val) onChange({ ...styleConfig, position: val as CaptionPosition });
            }}
          >
            <SelectTrigger id="caption-position-trigger" className="w-full h-9 bg-background">
              <SelectValue>
                {POSITION_OPTIONS.find((p) => p.value === styleConfig.position)?.label ?? 'Bottom'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {POSITION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caption-accent-color" className="text-xs font-semibold">
            Accent colour
          </Label>
          <div className="flex items-center gap-3">
            <input
              id="caption-accent-color"
              type="color"
              value={styleConfig.accentColor}
              onChange={(e) => onChange({ ...styleConfig, accentColor: e.target.value })}
              className="w-12 h-9 p-1 rounded-lg border border-input bg-background cursor-pointer"
            />
            <span className="font-mono text-xs text-muted-foreground uppercase tabular-nums">
              {styleConfig.accentColor}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3" onMouseLeave={() => onPreviewChange(null)}>
        <h3 className="font-heading text-sm font-bold text-foreground">
          Saved cloud presets
        </h3>
        <div className="flex items-center gap-2">
          <Label htmlFor="preset-name-input" className="sr-only">
            Preset name
          </Label>
          <Input
            id="preset-name-input"
            type="text"
            maxLength={64}
            placeholder="Preset name (e.g. MrBeast Punch)"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="flex-1 h-9 bg-background/60"
          />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={savingPreset}
            onClick={handleSave}
            className="whitespace-nowrap shrink-0 font-semibold cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{signedIn ? 'Save preset' : 'Sign in to save'}</span>
          </Button>
        </div>

        {presetMsg && (
          <Alert>
            <AlertDescription className="text-xs">{presetMsg}</AlertDescription>
          </Alert>
        )}

        {presets.length > 0 && (
          <div className="space-y-2">
            {presets.map((p) => {
              const candidate: StyleConfig = {
                style: p.style,
                fontFamily: p.fontFamily || 'manrope',
                position: p.position,
                accentColor: p.accentColor,
                fontSize: p.fontSize,
                wordSpacing: clampWordSpacing(p.wordSpacing ?? styleConfig.wordSpacing),
                revealMode: p.revealMode || styleConfig.revealMode,
                effect: p.effect || styleConfig.effect,
                wordsPerPage: p.wordsPerPage || styleConfig.wordsPerPage,
                pageLayout: p.pageLayout || styleConfig.pageLayout,
                spotlightAuto: p.spotlightAuto ?? true,
                blendMode: p.blendMode || 'normal',
              };
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl glass-subpanel px-3 py-2"
                >
                  <button
                    type="button"
                    onMouseEnter={() => onPreviewChange(candidate, p.name)}
                    onFocus={() => onPreviewChange(candidate, p.name)}
                    onBlur={() => onPreviewChange(null)}
                    onClick={() => {
                      onPreviewChange(null);
                      onChange(candidate);
                    }}
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <span
                      className="w-4 h-4 rounded-sm border border-border shrink-0"
                      style={{ backgroundColor: p.accentColor }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {p.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {p.style.replace('st-', '')} · {p.fontSize}px
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete preset ${p.name}`}
                    onClick={() => void onDeletePreset(p.id)}
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
