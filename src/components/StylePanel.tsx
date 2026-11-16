import { useState } from 'react';
import { BookmarkPlus, Trash2 } from 'lucide-react';
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
import {
  CAPTION_FONT_OPTIONS,
  CAPTION_STYLE_CATALOG,
  type CaptionFont,
  type CaptionPosition,
  type CaptionStyleCategory,
  type StyleConfig,
} from '../utils/captions';
import type { CloudStylePreset } from '../lib/firestoreService';

interface StylePanelProps {
  styleConfig: StyleConfig;
  presets: CloudStylePreset[];
  signedIn: boolean;
  onChange: (next: StyleConfig) => void;
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
          big{' '}
          <span className="inline-block scale-110" style={{ color: accent }}>
            POP
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
  presets,
  signedIn,
  onChange,
  onSavePreset,
  onDeletePreset,
  onSignInPrompt,
}: StylePanelProps) {
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetMsg, setPresetMsg] = useState('');

  const activeFontMeta =
    CAPTION_FONT_OPTIONS.find((f) => f.id === styleConfig.fontFamily) ?? CAPTION_FONT_OPTIONS[0];

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
      <div className="space-y-4">
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
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ ...styleConfig, style: opt.id })}
                      className={`min-h-[54px] px-3 py-2.5 rounded-xl text-left border backdrop-blur-md transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? 'border-primary bg-accent/70 text-foreground shadow-xs'
                          : 'border-border/70 glass-subpanel hover:bg-card/85 text-foreground'
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
                        {renderStyleSpecimen(opt.id, styleConfig.accentColor, activeFontMeta.cssFamily)}
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

      <Separator />

      <div className="space-y-3">
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
            placeholder="Preset name (e.g. Clean Serif Switch)"
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
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl glass-subpanel px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      style: p.style,
                      fontFamily: p.fontFamily || 'manrope',
                      position: p.position,
                      accentColor: p.accentColor,
                      fontSize: p.fontSize,
                    })
                  }
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
