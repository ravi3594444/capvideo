import { useEffect, useState, type RefObject } from 'react';
import { BookmarkPlus, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Trash2 } from 'lucide-react';
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
  clampTextHeight,
  clampVerticalPosition,
  clampWordSpacing,
  CURATED_PRESET_PACKS,
  ENTRANCE_EFFECT_OPTIONS,
  REVEAL_MODE_OPTIONS,
  TEXT_HEIGHT,
  resolveEffectiveEffect,
  resolveEffectiveReveal,
  type CaptionBlendMode,
  type CaptionCue,
  type CaptionFont,
  type CaptionPosition,
  type CaptionStyleCategory,
  type PageLayoutMode,
  type StyleConfig,
} from '../utils/captions';
import type { CloudStylePreset } from '../lib/firestoreService';
import { useVideoFrame } from '../hooks/useVideoFrame';
import { CaptionOverlay } from './CaptionOverlay';

interface StylePanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string | null;
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

type StyleBrowseTab = 'signature' | CaptionStyleCategory;

const STYLE_BROWSE_TABS: { id: StyleBrowseTab; label: string }[] = [
  { id: 'signature', label: 'Signature' },
  { id: 'simple', label: 'Simple' },
  { id: 'font-switch', label: 'Font switch' },
  { id: 'creator', label: 'Bold creator' },
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
    case 'st-behind-subject':
    case 'st-hero-moment':
      return <span className="font-extrabold tracking-tight" style={{ color: accent }}>{styleId === 'st-behind-subject' ? 'BEHIND YOU' : 'Hero moment'}</span>;
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
  videoRef,
  videoUrl,
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
  const [styleTab, setStyleTab] = useState<StyleBrowseTab>('signature');
  const videoFrame = useVideoFrame(videoRef, videoUrl);

  const displayedConfig = previewConfig ?? styleConfig;
  const textHeight = clampTextHeight(styleConfig.textHeight);
  const customPosition = clampVerticalPosition(styleConfig.verticalPosition);
  const presetPosition = styleConfig.position === 'pos-centre' ? 50 : styleConfig.position === 'pos-third' ? 75 : 100;
  const activeFontMeta =
    CAPTION_FONT_OPTIONS.find((f) => f.id === displayedConfig.fontFamily) ?? CAPTION_FONT_OPTIONS[0];
  const effectiveReveal = resolveEffectiveReveal(displayedConfig);
  const effectiveEffect = resolveEffectiveEffect(displayedConfig);

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
  const previewCue = {
    ...cueForPreview,
    text: cueForPreview.text.trim().split(/\s+/).slice(0, 6).join(' '),
    start: 0,
    end: 2,
  };
  const activeStyleMeta =
    CAPTION_STYLE_CATALOG.find((s) => s.id === displayedConfig.style) ?? CAPTION_STYLE_CATALOG[0];

  const spinStyle = (dir: -1 | 1) => {
    const idx = CAPTION_STYLE_CATALOG.findIndex((s) => s.id === styleConfig.style);
    const nextIdx = (idx + dir + CAPTION_STYLE_CATALOG.length) % CAPTION_STYLE_CATALOG.length;
    const chosen = CAPTION_STYLE_CATALOG[nextIdx];
    onPreviewChange(null);
    setStyleTab(chosen.category);
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
    <div className="space-y-4 @container/style">
      {/* Live Motion Audition Strip — always shows how styles/effects move BEFORE applying */}
      <div
        data-testid="live-style-preview"
        className="sticky top-2 md:top-[4.5rem] lg:static z-20 rounded-xl border border-border/90 bg-zinc-950 p-2.5 lg:p-3 space-y-1.5 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-semibold text-white truncate">
              {previewLabel ? `Previewing: ${previewLabel}` : `Applied: ${activeStyleMeta.label}`}
            </span>
            <span className="text-zinc-400 hidden sm:inline">
              {previewLabel ? (
                'Click to apply'
              ) : (
                <>
                  <span className="pointer-coarse:hidden">Hover card to audition</span>
                  <span className="hidden pointer-coarse:inline">Tap card to audition</span>
                </>
              )}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setAnimating((a) => !a)}
            aria-label={animating ? 'Pause motion preview' : 'Play motion preview'}
            className="text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer h-6 px-2 shrink-0"
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

        <div
          className="style-inspector-preview relative h-[132px] rounded-lg border border-white/10 overflow-hidden"
          style={
            videoFrame
              ? {
                  backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0.04) 60%), url(${videoFrame})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {
                  background:
                    'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), rgba(9,9,11,0.96) 75%)',
                }
          }
        >
          <span className="absolute left-2 top-1.5 text-[11px] text-white/75 bg-black/45 rounded px-1.5 py-0.5">
            {videoFrame ? 'On your video' : 'Sample backdrop'}
          </span>
          <CaptionOverlay
            cue={previewCue}
            fitHeight
            currentTime={loopElapsedSec}
            config={{ ...displayedConfig, position: 'pos-centre' }}
          />
        </div>
      </div>

      {/* Look Picker with Category Tabs (eliminates the 15-card scroll wall) */}
      <div className="space-y-2.5" onMouseLeave={() => onPreviewChange(null)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Caption style categories"
            className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 border border-border"
          >
            {STYLE_BROWSE_TABS.map((tab) => {
              const selected = styleTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setStyleTab(tab.id)}
                  className={`cap-word-chip px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
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

        {styleTab === 'signature' ? (
          <div className="grid grid-cols-1 @sm/style:grid-cols-2 @md/style:grid-cols-3 gap-2">
            {CURATED_PRESET_PACKS.map((pack) => {
              const isActive =
                styleConfig.style === pack.apply.style &&
                resolveEffectiveReveal(styleConfig) === (pack.apply.revealMode ?? resolveEffectiveReveal(styleConfig)) &&
                resolveEffectiveEffect(styleConfig) === (pack.apply.effect ?? resolveEffectiveEffect(styleConfig)) &&
                (styleConfig.blendMode ?? 'normal') === (pack.apply.blendMode ?? 'normal');
              const candidate = {
                ...styleConfig,
                ...pack.apply,
                verticalPosition: pack.apply.position ? undefined : customPosition,
              };
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
                  className={`px-3 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                    isActive
                      ? 'border-primary bg-accent/70 text-foreground'
                      : 'border-border/75 bg-background/40 hover:bg-accent/35 text-foreground'
                  }`}
                >
                  <div className="text-xs font-bold">{pack.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-1">
                    {pack.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            role="group"
            aria-label={STYLE_BROWSE_TABS.find((t) => t.id === styleTab)?.label}
            className="grid grid-cols-1 @sm/style:grid-cols-2 gap-2"
          >
            {CAPTION_STYLE_CATALOG.filter((s) => s.category === styleTab).map((opt) => {
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
                  className={`min-h-[52px] px-3 py-2 rounded-lg text-left border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    active
                      ? 'border-primary bg-accent/70 text-foreground'
                      : 'border-border/75 bg-background/40 hover:bg-accent/35 text-foreground'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-1">
                      {opt.desc}
                    </div>
                  </div>
                  <div
                    className="shrink-0 rounded bg-zinc-950/90 border border-white/10 px-2 py-1 text-[11px] leading-none"
                    aria-hidden="true"
                  >
                    {renderStyleSpecimen(opt.id, displayedConfig.accentColor, activeFontMeta.cssFamily)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3.5">
        <div className="grid grid-cols-1 @md/style:grid-cols-2 gap-4">
          <div className="space-y-2">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <Label htmlFor="caption-text-height">Text height</Label>
              <span className="font-mono text-muted-foreground tabular-nums">{textHeight}%</span>
            </div>
            <Slider
              id="caption-text-height"
              aria-label="Text height"
              getAriaValueText={(_, value) => `${value}% tall`}
              min={TEXT_HEIGHT.min}
              max={TEXT_HEIGHT.max}
              step={5}
              value={[textHeight]}
              onValueChange={(value) => onChange({
                ...styleConfig, textHeight: clampTextHeight(typeof value === 'number' ? value : value[0]),
              })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <Label htmlFor="caption-word-spacing">Word spacing</Label>
              <div className="flex items-center gap-2">
                {clampWordSpacing(styleConfig.wordSpacing) !== 0.26 && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...styleConfig, wordSpacing: 0.26 })}
                    className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 cursor-pointer"
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

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <Label htmlFor="caption-vertical-position">Vertical position</Label>
              <span className="font-mono text-muted-foreground tabular-nums">{customPosition ?? presetPosition}%</span>
            </div>
            <Slider
              id="caption-vertical-position"
              aria-label="Vertical position"
              getAriaValueText={(_, value) => `${value}% down the frame`}
              min={0}
              max={100}
              step={1}
              value={[customPosition ?? presetPosition]}
              onValueChange={(value) => onChange({
                ...styleConfig, verticalPosition: clampVerticalPosition(typeof value === 'number' ? value : value[0]),
              })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 @sm/style:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-foreground">Position</span>
            <div
              role="group"
              aria-label="Position presets"
              className="grid grid-cols-3 rounded-lg bg-muted/70 p-0.5 border border-border"
            >
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={customPosition === undefined && styleConfig.position === opt.value}
                  onClick={() => onChange({ ...styleConfig, position: opt.value, verticalPosition: undefined })}
                  className={`cap-word-chip py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    customPosition === undefined && styleConfig.position === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label === 'Lower third' ? 'Lower' : opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caption-font-trigger" className="text-xs font-semibold">
              Base font
            </Label>
            <Select
              value={styleConfig.fontFamily}
              onValueChange={(val) => {
                if (val) onChange({ ...styleConfig, fontFamily: val as CaptionFont });
              }}
            >
              <SelectTrigger id="caption-font-trigger" className="w-full h-9 bg-background text-xs">
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
            <Label htmlFor="caption-accent-color" className="text-xs font-semibold">
              Accent colour
            </Label>
            <div className="flex items-center gap-2.5">
              <input
                id="caption-accent-color"
                type="color"
                value={styleConfig.accentColor}
                onChange={(e) => onChange({ ...styleConfig, accentColor: e.target.value })}
                className="w-11 h-9 p-1 rounded-lg border border-input bg-background cursor-pointer"
              />
              <span className="font-mono text-xs text-muted-foreground uppercase tabular-nums">
                {styleConfig.accentColor}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Motion, Reveal & Layout Behaviour */}
      <div className="space-y-3" onMouseLeave={() => onPreviewChange(null)}>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Word reveal</Label>
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
                  className={`cap-word-chip px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background/50 text-muted-foreground border-border/80 hover:text-foreground'
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
                  className={`cap-word-chip px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background/50 text-muted-foreground border-border/80 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 @sm/style:grid-cols-3 gap-2.5 pt-1">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/40 px-2.5 py-2">
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

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/40 px-2.5 py-2">
            <span className="text-xs font-medium text-foreground">Pages</span>
            <div className="inline-flex items-center gap-0.5 rounded bg-muted p-0.5">
              {(['replace', 'stack'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={(styleConfig.pageLayout ?? 'replace') === mode}
                  onClick={() => onChange({ ...styleConfig, pageLayout: mode })}
                  className={`cap-word-chip px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer capitalize whitespace-nowrap ${
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

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/40 px-2.5 py-2">
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
                  className={`cap-word-chip px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer capitalize whitespace-nowrap ${
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

      <Separator />

      {/* Saved Cloud Presets */}
      <div className="space-y-2.5" onMouseLeave={() => onPreviewChange(null)}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-xs font-bold text-foreground">
            Saved presets
          </h3>
        </div>
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
            className="flex-1 h-9 bg-background/60 text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            size="default"
            disabled={savingPreset}
            onClick={handleSave}
            className="h-9 whitespace-nowrap shrink-0 font-semibold cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{signedIn ? 'Save' : 'Sign in'}</span>
          </Button>
        </div>

        {presetMsg && (
          <Alert>
            <AlertDescription className="text-xs">{presetMsg}</AlertDescription>
          </Alert>
        )}

        {presets.length > 0 && (
          <div className="divide-y divide-border/70 rounded-lg border border-border/80 bg-background/35">
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
                  className="flex items-center justify-between gap-3 px-3 py-2"
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
                      className="w-3.5 h-3.5 rounded-sm border border-border shrink-0"
                      style={{ backgroundColor: p.accentColor }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {p.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {p.style.replace('st-', '')} · {p.fontSize}px
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
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
