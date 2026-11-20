export type AspectRatio = 'r916' | 'r11' | 'r169';
export type CaptionStyle =
  | 'st-minimal'
  | 'st-editorial'
  | 'st-cinema'
  | 'st-classic'
  | 'st-font-switch'
  | 'st-font-snap'
  | 'st-kinetic-mix'
  | 'st-typewriter'
  | 'st-hormozi'
  | 'st-highlight'
  | 'st-pop'
  | 'st-cycle'
  | 'st-karaoke'
  | 'st-bounce'
  | 'st-neon'
  | 'st-behind-subject'
  | 'st-hero-moment';

export type CaptionFont = 'manrope' | 'system' | 'editorial' | 'impact' | 'mono';
export type CaptionPosition = 'pos-bottom' | 'pos-third' | 'pos-centre';

export type RevealMode = 'karaoke' | 'build' | 'flash' | 'pop' | 'spotlight';
export type EntranceEffect =
  | 'none'
  | 'fadeIn'
  | 'scaleUp'
  | 'bounce'
  | 'glitch'
  | 'typewriter'
  | 'scramble'
  | 'flipUp'
  | 'wave'
  | 'neonPulse'
  | 'maskSlide';
export type WordsPerPage = 'auto' | '2' | '3' | '4';
export type PageLayoutMode = 'replace' | 'stack';
export type CaptionBlendMode = 'normal' | 'difference';

export interface CaptionCue {
  id: string;
  start: number;
  end: number;
  text: string;
  keyWords?: string[];
  // Offsets within the cue, as fractions of its duration, so retiming moves the words with it.
  wordTiming?: WordTokenTimed[];
}

export const STYLE_PREVIEW_SAMPLE: CaptionCue = {
  id: 'preview_demo',
  start: 0,
  end: 2,
  text: 'Make every word count',
};

export interface StyleConfig {
  style: CaptionStyle;
  fontFamily: CaptionFont;
  position: CaptionPosition;
  accentColor: string;
  fontSize: number;
  textHeight?: number;
  verticalPosition?: number;
  wordSpacing?: number;
  revealMode?: RevealMode;
  effect?: EntranceEffect;
  wordsPerPage?: WordsPerPage;
  pageLayout?: PageLayoutMode;
  spotlightAuto?: boolean;
  blendMode?: CaptionBlendMode;
}

export const TEXT_HEIGHT = { min: 60, max: 180, normal: 100 };

export function clampTextHeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.min(TEXT_HEIGHT.max, Math.max(TEXT_HEIGHT.min, value)))
    : TEXT_HEIGHT.normal;
}

export function clampVerticalPosition(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.min(100, Math.max(0, value)))
    : undefined;
}

export function getCaptionPlacement(config: Pick<StyleConfig, 'position' | 'verticalPosition'>) {
  const verticalPosition = clampVerticalPosition(config.verticalPosition);
  if (verticalPosition !== undefined) {
    const origin = verticalPosition / 100;
    return { anchor: 0.06 + 0.88 * origin, origin, safeHeight: 0.88 };
  }
  if (config.position === 'pos-centre') return { anchor: 0.5, origin: 0.5, safeHeight: 0.92 };
  if (config.position === 'pos-third') return { anchor: 0.74, origin: 1, safeHeight: 0.72 };
  return { anchor: 0.94, origin: 1, safeHeight: 0.92 };
}

export function getCaptionFit(
  contentWidth: number, contentHeight: number, safeWidth: number, safeHeight: number, heightScale: number,
) {
  const heightFit = safeHeight / Math.max(1, contentHeight);
  const x = Math.min(1, safeWidth / Math.max(1, contentWidth), heightFit);
  return { x, y: Math.min(x * heightScale, heightFit) };
}

export function clampWordSpacing(val: unknown): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return 0.26;
  return Math.round(Math.max(0.06, Math.min(0.9, num)) * 100) / 100;
}

export interface TimedWord {
  word?: string;
  punctuated_word?: string;
  text?: string;
  start: number;
  end: number;
}

export interface TimedSegment {
  text?: string;
  start: number;
  end: number;
}

export const CAP_PALETTE = [
  '#ffd60a',
  '#ff5d8f',
  '#22d3ee',
  '#a3e635',
  '#fb923c',
  '#c084fc',
];

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  style: 'st-highlight',
  fontFamily: 'manrope',
  position: 'pos-bottom',
  accentColor: '#ffd60a',
  fontSize: 22,
  wordSpacing: 0.26,
  revealMode: 'karaoke',
  effect: 'scaleUp',
  wordsPerPage: 'auto',
  pageLayout: 'replace',
  spotlightAuto: true,
  blendMode: 'normal',
};

export interface CaptionFontOption {
  id: CaptionFont;
  label: string;
  desc: string;
  cssFamily: string;
}

export const CAPTION_FONT_OPTIONS: CaptionFontOption[] = [
  {
    id: 'manrope',
    label: 'Manrope Sans',
    desc: 'Clean modern sans',
    cssFamily: '"Manrope", system-ui, -apple-system, sans-serif',
  },
  {
    id: 'system',
    label: 'Simple Normal',
    desc: 'Standard system UI font',
    cssFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: 'editorial',
    label: 'Editorial Serif',
    desc: 'Playfair Display serif',
    cssFamily: '"Playfair Display", Georgia, serif',
  },
  {
    id: 'impact',
    label: 'Condensed Impact',
    desc: 'Oswald bold display',
    cssFamily: '"Oswald", Impact, sans-serif',
  },
  {
    id: 'mono',
    label: 'Technical Mono',
    desc: 'JetBrains Mono',
    cssFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
];

export function getCaptionFontStack(font: CaptionFont | undefined): string {
  const match = CAPTION_FONT_OPTIONS.find((f) => f.id === font);
  return match ? match.cssFamily : CAPTION_FONT_OPTIONS[0].cssFamily;
}

export type CaptionStyleCategory = 'simple' | 'font-switch' | 'creator';

export interface CaptionStyleMeta {
  id: CaptionStyle;
  category: CaptionStyleCategory;
  label: string;
  desc: string;
  noBackground?: boolean;
  defaultReveal: RevealMode;
  defaultEffect: EntranceEffect;
  defaultFont?: CaptionFont;
}

export const CAPTION_STYLE_CATALOG: CaptionStyleMeta[] = [
  {
    id: 'st-behind-subject',
    category: 'creator',
    label: 'Behind Subject',
    desc: 'Oversized text drifts behind the person in the video',
    noBackground: true,
    defaultReveal: 'flash',
    defaultEffect: 'none',
    defaultFont: 'impact',
  },
  {
    id: 'st-hero-moment',
    category: 'creator',
    label: 'Hero Moment',
    desc: 'The whole phrase grows together on an emphasized word',
    noBackground: true,
    defaultReveal: 'flash',
    defaultEffect: 'none',
    defaultFont: 'manrope',
  },
  {
    id: 'st-minimal',
    category: 'simple',
    label: 'Clean Normal',
    desc: 'Simple font, zero background color',
    noBackground: true,
    defaultReveal: 'flash',
    defaultEffect: 'fadeIn',
  },
  {
    id: 'st-editorial',
    category: 'simple',
    label: 'Editorial Serif',
    desc: 'Graceful serif, subtle italic pulse',
    noBackground: true,
    defaultReveal: 'spotlight',
    defaultEffect: 'fadeIn',
    defaultFont: 'editorial',
  },
  {
    id: 'st-cinema',
    category: 'simple',
    label: 'Cinema Matte',
    desc: 'Readable full-line translucent subtitle bar',
    defaultReveal: 'flash',
    defaultEffect: 'fadeIn',
  },
  {
    id: 'st-classic',
    category: 'simple',
    label: 'Classic Outline',
    desc: 'Crisp white outline with yellow spoken cue',
    defaultReveal: 'karaoke',
    defaultEffect: 'none',
  },
  {
    id: 'st-font-switch',
    category: 'font-switch',
    label: 'Serif Switch',
    desc: 'Active word shifts to italic serif on the beat',
    noBackground: true,
    defaultReveal: 'spotlight',
    defaultEffect: 'scaleUp',
  },
  {
    id: 'st-font-snap',
    category: 'font-switch',
    label: 'Impact Switch',
    desc: 'Spoken word snaps to condensed uppercase display',
    noBackground: true,
    defaultReveal: 'spotlight',
    defaultEffect: 'scaleUp',
  },
  {
    id: 'st-kinetic-mix',
    category: 'font-switch',
    label: 'Kinetic Trio',
    desc: 'Words alternate serif italic & mono at each beat',
    noBackground: true,
    defaultReveal: 'build',
    defaultEffect: 'bounce',
  },
  {
    id: 'st-typewriter',
    category: 'font-switch',
    label: 'Typewriter Reveal',
    desc: 'Monospace progressive reveal as words play',
    defaultReveal: 'build',
    defaultEffect: 'typewriter',
    defaultFont: 'mono',
  },
  {
    id: 'st-hormozi',
    category: 'creator',
    label: 'MrBeast Punch',
    desc: 'Heavy uppercase condensed display + scale punch',
    noBackground: true,
    defaultReveal: 'flash',
    defaultEffect: 'scaleUp',
    defaultFont: 'impact',
  },
  {
    id: 'st-highlight',
    category: 'creator',
    label: 'Word Highlight',
    desc: 'Spoken word pops inside a bright yellow box',
    defaultReveal: 'karaoke',
    defaultEffect: 'scaleUp',
  },
  {
    id: 'st-pop',
    category: 'creator',
    label: 'One-Word Pop',
    desc: 'Punches one spoken word center-beat at a time',
    noBackground: true,
    defaultReveal: 'pop',
    defaultEffect: 'scaleUp',
  },
  {
    id: 'st-cycle',
    category: 'creator',
    label: 'Colour Cycle',
    desc: 'Each word cycles through bright palette colors',
    defaultReveal: 'build',
    defaultEffect: 'bounce',
  },
  {
    id: 'st-karaoke',
    category: 'creator',
    label: 'Karaoke Fill',
    desc: 'Sing-along progress fill as words play',
    defaultReveal: 'karaoke',
    defaultEffect: 'fadeIn',
  },
  {
    id: 'st-bounce',
    category: 'creator',
    label: 'Elastic Bounce',
    desc: 'Dynamic upward bounce & tilt on spoken word',
    noBackground: true,
    defaultReveal: 'karaoke',
    defaultEffect: 'bounce',
  },
  {
    id: 'st-neon',
    category: 'creator',
    label: 'Neon Pulse',
    desc: 'Luminous breathing neon glow across palette',
    noBackground: true,
    defaultReveal: 'spotlight',
    defaultEffect: 'neonPulse',
  },
];

export interface CuratedPresetPack {
  id: string;
  label: string;
  subtitle: string;
  apply: Partial<StyleConfig>;
}

export const CURATED_PRESET_PACKS: CuratedPresetPack[] = [
  {
    id: 'pack-behind-subject',
    label: 'Behind Subject',
    subtitle: 'Oversized captions drift behind the person',
    apply: { style: 'st-behind-subject', fontFamily: 'impact', position: 'pos-centre', fontSize: 34, revealMode: 'flash', effect: 'none', pageLayout: 'replace', blendMode: 'normal', accentColor: '#e7fa69' },
  },
  {
    id: 'pack-hero-moment',
    label: 'Hero Moment',
    subtitle: 'Punch in on the whole phrase at a key word',
    apply: { style: 'st-hero-moment', fontFamily: 'manrope', position: 'pos-centre', fontSize: 28, revealMode: 'flash', effect: 'none', pageLayout: 'replace', blendMode: 'normal', accentColor: '#fff279' },
  },
  {
    id: 'pack-mrbeast',
    label: 'MrBeast Punch',
    subtitle: 'Short phrases, with one bright word on the beat',
    apply: {
      style: 'st-hormozi',
      fontFamily: 'impact',
      revealMode: 'flash',
      effect: 'scaleUp',
      wordsPerPage: '3',
      spotlightAuto: true,
      blendMode: 'normal',
      accentColor: '#ffd60a',
      fontSize: 25,
      wordSpacing: 0.18,
    },
  },
  {
    id: 'pack-spotlight',
    label: 'Spotlight Mix',
    subtitle: 'Colored key words with a serif accent',
    apply: {
      style: 'st-font-switch',
      fontFamily: 'manrope',
      revealMode: 'spotlight',
      effect: 'fadeIn',
      wordsPerPage: '4',
      spotlightAuto: true,
      blendMode: 'normal',
      accentColor: '#22d3ee',
      fontSize: 24,
    },
  },
  {
    id: 'pack-pop-word',
    label: 'One-Word Pop',
    subtitle: 'Rapid centered single-word kinetic hook',
    apply: {
      style: 'st-pop',
      fontFamily: 'impact',
      revealMode: 'pop',
      effect: 'bounce',
      wordsPerPage: '3',
      spotlightAuto: true,
      blendMode: 'normal',
      accentColor: '#a3e635',
      fontSize: 30,
    },
  },
  {
    id: 'pack-editorial',
    label: 'Editorial Clean',
    subtitle: 'Zero background box · Stackable stacked phrasing',
    apply: {
      style: 'st-minimal',
      fontFamily: 'manrope',
      revealMode: 'flash',
      effect: 'maskSlide',
      wordsPerPage: '4',
      pageLayout: 'stack',
      spotlightAuto: false,
      blendMode: 'normal',
      fontSize: 21,
    },
  },
  {
    id: 'pack-difference',
    label: 'Difference Invert',
    subtitle: 'Inverts colors over bright footage automatically',
    apply: {
      style: 'st-hormozi',
      fontFamily: 'impact',
      revealMode: 'flash',
      effect: 'scaleUp',
      wordsPerPage: '3',
      spotlightAuto: true,
      blendMode: 'difference',
      accentColor: '#ffffff',
      fontSize: 26,
    },
  },
  {
    id: 'pack-cyber',
    label: 'Glitch Decode',
    subtitle: 'Scramble + RGB split reveal in crisp monospace',
    apply: {
      style: 'st-typewriter',
      fontFamily: 'mono',
      revealMode: 'build',
      effect: 'glitch',
      wordsPerPage: '4',
      spotlightAuto: true,
      blendMode: 'normal',
      accentColor: '#22d3ee',
      fontSize: 22,
    },
  },
  {
    id: 'pack-color-spotlight',
    label: 'Color Spotlight',
    subtitle: 'One accent draws the eye while the words stay the same size',
    apply: { position: 'pos-third', style: 'st-minimal', fontFamily: 'manrope', revealMode: 'spotlight', effect: 'none', fontSize: 23, accentColor: '#bcf57a', wordSpacing: 0.2 },
  },
  {
    id: 'pack-quiet-reveal',
    label: 'Quiet Reveal',
    subtitle: 'Clean white type, one word at a time',
    apply: { position: 'pos-third', style: 'st-minimal', fontFamily: 'manrope', revealMode: 'build', effect: 'fadeIn', fontSize: 21, wordSpacing: 0.21 },
  },
  {
    id: 'pack-headline-beat',
    label: 'Headline Beat',
    subtitle: 'An oversized keyword on its own line',
    apply: { position: 'pos-third', style: 'st-minimal', fontFamily: 'manrope', revealMode: 'flash', effect: 'scaleUp', fontSize: 23, accentColor: '#ffffff' },
  },
  {
    id: 'pack-comic-beat',
    label: 'Comic Beat',
    subtitle: 'Violet letters with a white outline',
    apply: { style: 'st-pop', fontFamily: 'impact', revealMode: 'pop', effect: 'flipUp', fontSize: 28, accentColor: '#ad92ff', position: 'pos-third' },
  },
  {
    id: 'pack-amber-stack',
    label: 'Amber Stack',
    subtitle: 'A condensed, amber headline',
    apply: { position: 'pos-third', style: 'st-hormozi', fontFamily: 'impact', revealMode: 'flash', effect: 'maskSlide', fontSize: 22, accentColor: '#ffbc61' },
  },
  {
    id: 'pack-electric-blue',
    label: 'Electric Blue',
    subtitle: 'Cool-blue emphasis with a slight wave',
    apply: { position: 'pos-third', style: 'st-font-snap', fontFamily: 'impact', revealMode: 'flash', effect: 'wave', fontSize: 22, accentColor: '#74c8ff' },
  },
  {
    id: 'pack-lavender-note',
    label: 'Lavender Note',
    subtitle: 'A soft pill on the key word as it is spoken',
    apply: { position: 'pos-third', style: 'st-highlight', fontFamily: 'manrope', revealMode: 'karaoke', effect: 'fadeIn', fontSize: 21, accentColor: '#d3c1fd', wordSpacing: 0.2 },
  },
  {
    id: 'pack-white-label',
    label: 'White Label',
    subtitle: 'Dark text on a clean white strip',
    apply: { position: 'pos-third', style: 'st-minimal', fontFamily: 'mono', revealMode: 'flash', effect: 'flipUp', fontSize: 19, accentColor: '#222222' },
  },
  {
    id: 'pack-red-stamp',
    label: 'Red Stamp',
    subtitle: 'A red tag that lands on each beat',
    apply: { position: 'pos-third', style: 'st-typewriter', fontFamily: 'mono', revealMode: 'pop', effect: 'flipUp', fontSize: 24, accentColor: '#e23652' },
  },
  {
    id: 'pack-marker-mix',
    label: 'Marker Mix',
    subtitle: 'Handwritten type with two-tone emphasis',
    apply: { position: 'pos-third', style: 'st-kinetic-mix', fontFamily: 'manrope', revealMode: 'flash', effect: 'wave', fontSize: 26, wordSpacing: 0.19, accentColor: '#d7fb7d' },
  },
  {
    id: 'pack-dispatch',
    label: 'Dispatch',
    subtitle: 'An orange tag appears on the key word',
    apply: { position: 'pos-third', style: 'st-highlight', fontFamily: 'mono', revealMode: 'karaoke', effect: 'maskSlide', fontSize: 20, accentColor: '#ffbf97' },
  },
  {
    id: 'pack-editorial-strip',
    label: 'Editorial Strip',
    subtitle: 'Cream serif lettering on a red masthead',
    apply: { position: 'pos-third', style: 'st-editorial', fontFamily: 'editorial', revealMode: 'flash', effect: 'maskSlide', fontSize: 24, accentColor: '#9d2438' },
  },
];

export const REVEAL_MODE_OPTIONS: { id: RevealMode; label: string; desc: string }[] = [
  { id: 'karaoke', label: 'Karaoke', desc: 'Full line visible; active word pops' },
  { id: 'spotlight', label: 'Spotlight', desc: 'Accent on key words; motion depends on the entrance effect' },
  { id: 'build', label: 'Build', desc: 'Words reveal progressively left-to-right' },
  { id: 'flash', label: 'Flash', desc: 'Whole short phrase hits cleanly at once' },
  { id: 'pop', label: 'One-Word', desc: 'Single spoken word centered on the beat' },
];

export const ENTRANCE_EFFECT_OPTIONS: { id: EntranceEffect; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fadeIn', label: 'Fade in' },
  { id: 'scaleUp', label: 'Scale punch' },
  { id: 'bounce', label: 'Elastic bounce' },
  { id: 'maskSlide', label: 'Mask slide' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'scramble', label: 'Scramble decode' },
  { id: 'glitch', label: 'Glitch RGB' },
  { id: 'flipUp', label: 'Flip up' },
  { id: 'wave', label: 'Sine wave' },
  { id: 'neonPulse', label: 'Neon pulse' },
];

export function getCaptionBlockMotion(
  style: CaptionStyle, cue: CaptionCue, time: number, spotlightAuto = true,
) {
  if (style !== 'st-behind-subject' && style !== 'st-hero-moment') {
    return { fontScale: 1, blockScale: 1, shift: 0 };
  }

  const cueProgress = Math.max(0, Math.min(1, (time - cue.start) / Math.max(0.1, cue.end - cue.start)));
  if (style === 'st-behind-subject') {
    return { fontScale: 1.95, blockScale: 1, shift: 0.05 * (1 - 2 * cueProgress) };
  }

  const words = cue.text.trim().split(/\s+/);
  const keys = getCaptionSpotlightWords(cue, spotlightAuto);
  const beat = words.findIndex(word => keys.includes(normalizeToken(word)));
  if (beat < 0) return { fontScale: 1.2, blockScale: 1, shift: 0 };

  const clock = getCaptionWordClock(cue, time, words);
  const progress = Math.min(1, Math.max(0, clock.elapsed) / Math.max(0.12, Math.min(0.36, clock.duration)));
  const punch = clock.index === beat ? Math.sin(Math.PI * progress) : 0;
  return { fontScale: 1.2, blockScale: 1 + 0.48 * punch, shift: 0 };
}

export function resolveEffectiveReveal(config: StyleConfig): RevealMode {
  if (config.revealMode) return config.revealMode;
  return CAPTION_STYLE_CATALOG.find((s) => s.id === config.style)?.defaultReveal ?? 'karaoke';
}

export function resolveEffectiveEffect(config: StyleConfig): EntranceEffect {
  if (config.effect) return config.effect;
  return CAPTION_STYLE_CATALOG.find((s) => s.id === config.style)?.defaultEffect ?? 'scaleUp';
}

export interface CaptionContainerSpec {
  hasFullLineBackdrop: boolean;
  backdropColor: string | null;
}

export function getCaptionContainerSpec(style: CaptionStyle, effect?: EntranceEffect, accentColor?: string): CaptionContainerSpec {
  const backdropColor = style === 'st-cinema' ? 'rgba(10, 10, 14, 0.78)'
    : style === 'st-minimal' && effect === 'flipUp' ? '#f9f8f6'
    : style === 'st-editorial' && effect === 'maskSlide' ? accentColor ?? '#9d2438'
    : null;
  return { hasFullLineBackdrop: Boolean(backdropColor), backdropColor };
}

function usesHeadlineLayout(style: CaptionStyle, effect: EntranceEffect): boolean {
  return (style === 'st-minimal' && effect === 'scaleUp')
    || (style === 'st-hormozi' && effect === 'maskSlide')
    || (style === 'st-font-snap' && effect === 'wave');
}

export function getCaptionHeadlineIndex(
  cue: CaptionCue, words: string[], style: CaptionStyle, effect: EntranceEffect, spotlightAuto = true
): number {
  if (!usesHeadlineLayout(style, effect)) return -1;
  const preferred = getCaptionSpotlightWords(cue, spotlightAuto);
  for (const key of preferred) {
    const index = words.findIndex(word => normalizeToken(word) === key);
    if (index >= 0) return index;
  }
  return -1;
}

export function getCaptionWordRows(words: string[], headlineIndex: number, wordsPerRow: number) {
  const indexed = words.map((word, index) => ({ word, index }));
  const groups = headlineIndex < 0 ? [indexed] : [
    indexed.slice(0, headlineIndex),
    indexed.slice(headlineIndex, headlineIndex + 1),
    indexed.slice(headlineIndex + 1),
  ];
  const rows: (typeof indexed)[] = [];
  for (const group of groups) {
    for (let i = 0; i < group.length; i += wordsPerRow) rows.push(group.slice(i, i + wordsPerRow));
  }
  return rows;
}

export function getCaptionDisplayRows(config: StyleConfig, words: string[], headlineIndex: number) {
  const explicitSize = Number(config.wordsPerPage);
  if (config.style === 'st-behind-subject' && !explicitSize && words.length <= 6) {
    const indexed = words.map((word, index) => ({ word, index }));
    const split = Math.floor(words.length / 2);
    return split > 0 ? [indexed.slice(0, split), indexed.slice(split)] : [indexed];
  }
  return getCaptionWordRows(words, headlineIndex, explicitSize || (config.style === 'st-behind-subject' ? 3 : 4));
}

export function getDepthRowAppearance(style: CaptionStyle, row: number, accentColor: string) {
  if (style !== 'st-behind-subject') return { scale: 1, color: undefined };
  return row % 2 === 1 ? { scale: 0.78, color: accentColor } : { scale: 1, color: '#ffffff' };
}

// =====================================================================
// VideoCaptions.ai-inspired Spotlight Key Word & Negative Word Detector
// =====================================================================

const WEAK_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'as', 'at', 'by', 'for', 'from',
  'in', 'into', 'of', 'on', 'onto', 'out', 'over', 'to', 'up', 'with', 'without',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
  'they', 'them', 'their', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'not', 'no', 'yes', 'just', 'very', 'really', 'quite', 'so', 'too', 'also', 'well', 'now', 'here', 'there', 'when', 'where', 'how', 'why', 'what', 'who', 'which',
  'um', 'uh', 'er', 'ah', 'hmm', 'like', 'basically', 'literally', 'actually',
]);

const SPOKEN_FILLER = /^(?:u+h+|u+m+|e{2,}|e+h+|h+m+|a+h+)$/i;
const COMPARISON_WORDS = new Set(['vs', 'or', 'versus']);

const NEGATIVE_WORDS = new Set([
  "can't", 'cant', 'never', "don't", 'dont', "won't", 'wont', 'stop', 'quit', 'fail', 'failed',
  'mistake', 'mistakes', 'wrong', 'broken', 'lost', 'worst', 'avoid', 'zero', 'nothing', 'bad',
]);

export function normalizeToken(raw: string): string {
  return raw.toLowerCase().normalize('NFKC').replace(/’/g, "'")
    .replace(/^[^\p{L}\p{M}\p{N}\p{Sc}%]+|[^\p{L}\p{M}\p{N}\p{Sc}%]+$/gu, '');
}

export function isNegativeEmphasisWord(raw: string): boolean {
  const norm = normalizeToken(raw);
  return NEGATIVE_WORDS.has(norm);
}

export function extractAutoKeyWords(text: string): string[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const normalized = tokens.map(normalizeToken);
  const scores = new Map<string, number>();
  let comparison = false;

  tokens.forEach((raw, index) => {
    const word = normalized[index];
    if (!word || (WEAK_STOP_WORDS.has(word) && !NEGATIVE_WORDS.has(word)) || SPOKEN_FILLER.test(word) || COMPARISON_WORDS.has(word)) return;
    const paired = COMPARISON_WORDS.has(normalized[index - 1]) || COMPARISON_WORDS.has(normalized[index + 1])
      || tokens[index - 1] === '&' || tokens[index + 1] === '&';
    const numeric = /[\p{N}\p{Sc}%]/u.test(word);
    const entity = index > 0 && /^[A-Z][a-z]{2,}/.test(raw.replace(/^[^\p{L}]+/u, ''));
    const negative = NEGATIVE_WORDS.has(word);
    if (word.length < 3 && !numeric && !negative) return;
    comparison ||= paired;

    const score = Math.min(word.length, 9) / 4 + (index === tokens.length - 1 ? 0.8 : 0)
      + (numeric ? 18 : 0) + (paired ? 12 : 0)
      + (entity ? 7 : 0) + (negative ? 6 : 0) + (word === 'never' ? 2 : 0)
      + (/^[A-Z]{3,}$/.test(raw.replace(/[^a-z]/gi, '')) ? 4 : 0);
    scores.set(word, Math.max(score, scores.get(word) ?? 0));
  });

  const limit = tokens.length > 5 ? 3 : tokens.length === 5 || comparison ? 2 : 1;
  return [...scores].sort((first, second) => second[1] - first[1]).slice(0, limit).map(([word]) => word);
}

export function getCaptionSpotlightWords(cue: Pick<CaptionCue, 'text' | 'keyWords'>, spotlightAuto = true): string[] {
  if (Array.isArray(cue.keyWords)) return cue.keyWords.map(normalizeToken).filter(Boolean);
  return spotlightAuto ? extractAutoKeyWords(cue.text) : [];
}

export function isWordSpotlightKey(
  rawWord: string,
  cue: Pick<CaptionCue, 'text' | 'keyWords'>,
  spotlightAuto = true
): boolean {
  const word = normalizeToken(rawWord);
  return Boolean(word && getCaptionSpotlightWords(cue, spotlightAuto).includes(word));
}

export function toggleCueKeyWord(cue: CaptionCue, rawWord: string, spotlightAuto = true): CaptionCue {
  const norm = normalizeToken(rawWord);
  if (!norm) return cue;
  const base = getCaptionSpotlightWords(cue, spotlightAuto);
  const exists = base.includes(norm);
  const next = exists ? base.filter((w) => w !== norm) : [...base, norm];
  return {
    ...cue,
    keyWords: next,
  };
}

// =====================================================================
// Smart Filler Removal & Smart Line Breaking (VideoCaptions.ai rules)
// =====================================================================

const FILLER_REGEX = /\b(uh+|um+|er+|ah+|hmm+|you know|i mean)\b[,.\s]*/gi;

export function removeFillerWordsFromCues(cues: CaptionCue[]): CaptionCue[] {
  return cues
    .map((c) => {
      const cleaned = c.text
        .replace(FILLER_REGEX, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();
      return {
        ...c,
        text: cleaned,
      };
    })
    .filter((c) => c.text.length > 0);
}

const TITLE_ABBREVIATIONS = new Set(['dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'sr.', 'jr.', 'st.']);
const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'twenty', 'thirty', 'forty', 'fifty', 'hundred', 'thousand', 'million',
]);
const WEAK_TRAILING_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'so', 'to', 'of', 'in', 'on', 'at', 'for', 'with',
  'will', 'has', 'have', 'had', 'is', 'are', 'was', 'were', 'can', 'could', 'would', 'should', 'my', 'your', 'our', 'their',
]);

function isNumericToken(raw: string): boolean {
  const clean = normalizeToken(raw);
  return /^\d+([.,]\d+)?$/.test(clean) || NUMBER_WORDS.has(clean);
}

export interface WordTokenTimed {
  text: string;
  start: number;
  end: number;
}

function getTimedCaptionWords(cue: CaptionCue, words: string[]): WordTokenTimed[] | undefined {
  const stored = cue.wordTiming;
  if (!stored || stored.length !== words.length || !stored.every((word, i) =>
    normalizeToken(word.text) === normalizeToken(words[i]))) return undefined;

  const duration = cue.end - cue.start;
  return stored.map((word, i) => ({
    text: words[i],
    start: cue.start + word.start * duration,
    end: cue.start + word.end * duration,
  }));
}

function attachWordTiming(cue: CaptionCue, tokens: WordTokenTimed[]): CaptionCue {
  const span = Math.max(0.001, cue.end - cue.start);
  const fraction = (time: number) => Math.max(0, Math.min(1, (time - cue.start) / span));
  return { ...cue, wordTiming: tokens.map(token => ({
    text: token.text,
    start: fraction(token.start),
    end: fraction(token.end),
  })) };
}

export function cuesToTimedTokens(cues: CaptionCue[]): WordTokenTimed[] {
  return cues.slice().sort((a, b) => a.start - b.start).flatMap(cue => {
    const words = cue.text.trim().split(/\s+/).filter(Boolean);
    const per = Math.max(0.2, cue.end - cue.start) / Math.max(1, words.length);
    return getTimedCaptionWords(cue, words) ?? words.map((text, i) => ({
      text,
      start: Math.round((cue.start + i * per) * 100) / 100,
      end: Math.round((cue.start + (i + 1) * per) * 100) / 100,
    }));
  });
}

/**
 * Smart line-breaking & pause-aware hold engine inspired by VideoCaptions.ai:
 * - Target 2, 3, 4 words or Auto (char/clause length)
 * - Never splits across sentence-ending punctuation (. ! ?)
 * - Keeps numbers attached to what they count ("three push-ups")
 * - Keeps titles attached to names ("Dr. Smith")
 * - Avoids ending a caption on weak hanging words ("will", "has", "the", "a")
 * - Never leaves a solitary single orphan word if avoidable
 * - Extends short cue end cleanly up to +0.85s during trailing pauses without overlapping next cue
 */
export function regroupCaptionsSmart(
  cues: CaptionCue[],
  wordsPerPage: WordsPerPage = 'auto',
  pauseHoldSec = 0.8
): CaptionCue[] {
  const tokens = cuesToTimedTokens(cues);
  if (tokens.length === 0) return [];

  const targetMax =
    wordsPerPage === '2' ? 2 : wordsPerPage === '3' ? 3 : wordsPerPage === '4' ? 4 : 4;
  const preserveTiming = cues.some(cue => cue.wordTiming);
  const groups: WordTokenTimed[][] = [];
  let buf: WordTokenTimed[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const prev = buf.length > 0 ? buf[buf.length - 1] : null;

    if (prev && tok.start - prev.end > 0.75) {
      groups.push(buf);
      buf = [tok];
      continue;
    }

    buf.push(tok);

    const lowerLast = tok.text.toLowerCase();
    const isTitleAbbr = TITLE_ABBREVIATIONS.has(lowerLast);
    const endsSentence = /[.!?]$/.test(tok.text) && !isTitleAbbr;
    const currentChars = buf.reduce((sum, item) => sum + item.text.length + 1, 0);
    const cleanLast = normalizeToken(tok.text);
    const nextTok = tokens[i + 1];

    // Hard keep-together pairs: title ("Dr.") + next, numeric ("three") + next noun
    const mustKeepNext =
      nextTok &&
      (isTitleAbbr || isNumericToken(tok.text)) &&
      !endsSentence;

    const avoidWeakTrail =
      nextTok && WEAK_TRAILING_WORDS.has(cleanLast) && buf.length < targetMax + 1 && !endsSentence;

    const hitWordBudget =
      wordsPerPage === 'auto'
        ? buf.length >= 4 || (buf.length >= 3 && currentChars >= 18)
        : buf.length >= targetMax;

    const avoidSingleOrphanLookahead =
      tokens.length - 1 - i === 1 && buf.length <= targetMax && !endsSentence;

    if (endsSentence || (hitWordBudget && !mustKeepNext && !avoidWeakTrail && !avoidSingleOrphanLookahead)) {
      groups.push(buf);
      buf = [];
    }
  }
  if (buf.length > 0) {
    // Prevent solitary 1-word final orphan when previous group was multi-word and doesn't end a sentence
    if (
      buf.length === 1 &&
      groups.length > 0 &&
      !/[.!?]$/.test(groups[groups.length - 1][groups[groups.length - 1].length - 1].text) &&
      groups[groups.length - 1].length <= 4
    ) {
      groups[groups.length - 1].push(buf[0]);
    } else {
      groups.push(buf);
    }
  }

  return groups.map((g, idx) => {
    const start = Math.round(g[0].start * 100) / 100;
    const rawEnd = Math.max(start + 0.3, g[g.length - 1].end);
    const nextStart = idx < groups.length - 1 ? groups[idx + 1][0].start : Number.POSITIVE_INFINITY;
    const maxAllowedEnd = nextStart - 0.04;
    const heldEnd = Math.min(maxAllowedEnd, rawEnd + Math.max(0, pauseHoldSec));
    const end = Math.round(Math.max(start + 0.25, Math.max(rawEnd, heldEnd)) * 100) / 100;
    const cue = { id: createCueId(idx), start, end, text: g.map(t => t.text).join(' ') };
    return preserveTiming ? attachWordTiming(cue, g) : cue;
  });
}

// =====================================================================
// Unified Word + Frame Animation Evaluator (1:1 DOM Stage & Canvas)
// =====================================================================

export type WordShadowMode = 'none' | 'soft' | 'outline' | 'heavy-outline' | 'neon';

export interface WordVisualSpec {
  displayText: string;
  fontCss: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  color: string;
  backgroundColor: string | null;
  opacity: number;
  scale: number;
  translateYEm: number;
  rotateDeg: number;
  shadowMode: WordShadowMode;
  glitchDxPx?: number;
  glitchColorShift?: boolean;
  isSpotlightKey?: boolean;
  isHidden?: boolean;
  outlineColor?: string;
  borderRadiusEm?: number;
}

const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%';

function scrambleString(word: string, revealRatio: number, seed: number): string {
  if (revealRatio >= 1) return word;
  const locked = Math.floor(word.length * Math.max(0, revealRatio));
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (i < locked || /[^a-zA-Z0-9]/.test(ch)) {
      out += ch;
    } else {
      const idx = Math.abs(seed + i * 7) % SCRAMBLE_GLYPHS.length;
      out += SCRAMBLE_GLYPHS[idx];
    }
  }
  return out;
}

export function getWordVisualSpec(opts: {
  style: CaptionStyle;
  fontFamily?: CaptionFont;
  word: string;
  wordIndex: number;
  activeWordIndex: number;
  accentColor: string;
  revealMode?: RevealMode;
  effect?: EntranceEffect;
  cueElapsedSec?: number;
  cueDurationSec?: number;
  wordElapsedSec?: number;
  wordDurationSec?: number;
  isSpotlightKey?: boolean;
  isHeadlineWord?: boolean;
  isNegative?: boolean;
  currentTimeSec?: number;
}): WordVisualSpec {
  const {
    style,
    fontFamily,
    word,
    wordIndex,
    activeWordIndex,
    accentColor,
    revealMode,
    effect = 'none',
    cueElapsedSec = 0.25,
    cueDurationSec = 1.5,
    wordElapsedSec,
    wordDurationSec = 0.3,
    isSpotlightKey = false,
    isHeadlineWord = false,
    isNegative = false,
    currentTimeSec = 0,
  } = opts;

  const effectiveReveal =
    revealMode ?? CAPTION_STYLE_CATALOG.find((s) => s.id === style)?.defaultReveal ?? 'karaoke';

  const isOn = wordIndex === activeWordIndex;
  const isPast = wordIndex < activeWordIndex;
  const isFuture = wordIndex > activeWordIndex;

  const baseFont = getCaptionFontStack(fontFamily ?? CAPTION_STYLE_CATALOG.find(entry => entry.id === style)?.defaultFont);
  const serifFont = '"Playfair Display", Georgia, serif';
  const impactFont = '"Oswald", Impact, sans-serif';
  const monoFont = '"JetBrains Mono", ui-monospace, monospace';

  let spec: WordVisualSpec;

  switch (style) {
    case 'st-behind-subject':
    case 'st-hero-moment':
      spec = {
        displayText: style === 'st-behind-subject' ? word.toUpperCase() : word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: style === 'st-hero-moment' && isSpotlightKey ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
      break;
    case 'st-minimal':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: isSpotlightKey ? 800 : 600,
        fontStyle: 'normal',
        color: isOn ? '#ffffff' : 'rgba(255, 255, 255, 0.92)',
        backgroundColor: null,
        opacity: isOn ? 1 : 0.92,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
      break;

    case 'st-editorial':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 700,
        fontStyle: isOn || isSpotlightKey ? 'italic' : 'normal',
        color: isOn || isSpotlightKey ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.08 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
      break;

    case 'st-cinema':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: isOn || isSpotlightKey ? 700 : 500,
        fontStyle: 'normal',
        color: isOn ? '#ffffff' : '#e4e4e7',
        backgroundColor: null,
        opacity: 1,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'none',
      };
      break;

    case 'st-font-switch':
      spec = {
        displayText: word,
        fontCss: isOn || isSpotlightKey ? serifFont : baseFont,
        fontWeight: isOn || isSpotlightKey ? 700 : 600,
        fontStyle: isOn || isSpotlightKey ? 'italic' : 'normal',
        color: isOn || isSpotlightKey ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.18 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
      break;

    case 'st-font-snap':
      spec = {
        displayText: isOn || isSpotlightKey ? word.toUpperCase() : word,
        fontCss: isOn || isSpotlightKey ? impactFont : baseFont,
        fontWeight: isOn || isSpotlightKey ? 700 : 500,
        fontStyle: 'normal',
        color: isOn || isSpotlightKey ? accentColor : 'rgba(255, 255, 255, 0.92)',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.2 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: isOn || isSpotlightKey ? 'heavy-outline' : 'soft',
      };
      break;

    case 'st-kinetic-mix': {
      const activeOrKey = isOn || isSpotlightKey;
      const useMono = activeOrKey && wordIndex % 2 === 1;
      const useSerif = activeOrKey && wordIndex % 2 === 0;
      spec = {
        displayText: useMono ? word.toUpperCase() : word,
        fontCss: useMono ? monoFont : useSerif ? serifFont : baseFont,
        fontWeight: activeOrKey ? 700 : 600,
        fontStyle: useSerif ? 'italic' : 'normal',
        color: activeOrKey ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.18 : 1,
        translateYEm: isOn ? -0.05 : 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
      break;
    }

    case 'st-typewriter':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: isOn ? 700 : 500,
        fontStyle: 'normal',
        color: isOn || isSpotlightKey ? accentColor : '#ffffff',
        backgroundColor: isOn ? 'rgba(255, 255, 255, 0.14)' : null,
        opacity: isFuture ? 0.28 : 1,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
      break;

    case 'st-hormozi':
      spec = {
        displayText: word.toUpperCase(),
        fontCss: baseFont,
        fontWeight: 700,
        fontStyle: 'normal',
        color: isOn && isSpotlightKey ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn && isSpotlightKey ? 1.15 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'heavy-outline',
      };
      break;

    case 'st-pop':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: isOn || isSpotlightKey ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.18 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
      break;

    case 'st-cycle':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: CAP_PALETTE[wordIndex % CAP_PALETTE.length],
        backgroundColor: isOn ? '#111111' : null,
        opacity: 1,
        scale: isOn ? 1.22 : 1,
        translateYEm: 0,
        rotateDeg: isOn ? -2 : 0,
        shadowMode: 'outline',
      };
      break;

    case 'st-karaoke':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: isOn
          ? '#111111'
          : isPast
            ? CAP_PALETTE[wordIndex % CAP_PALETTE.length]
            : '#ffffff',
        backgroundColor: isOn ? accentColor : null,
        opacity: !isOn && isFuture ? 0.92 : 1,
        scale: isOn ? 1.14 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: isOn ? 'none' : 'outline',
      };
      break;

    case 'st-bounce':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: isOn || isSpotlightKey ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.34 : 1,
        translateYEm: isOn ? -0.14 : 0,
        rotateDeg: isOn ? -2 : 0,
        shadowMode: 'soft',
      };
      break;

    case 'st-neon':
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: CAP_PALETTE[wordIndex % CAP_PALETTE.length],
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.2 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'neon',
      };
      break;

    case 'st-classic':
    case 'st-highlight':
    default:
      spec = {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: isOn ? '#111111' : '#ffffff',
        backgroundColor: isOn ? '#fde047' : null,
        opacity: 1,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: isOn ? 'none' : 'outline',
      };
      break;
  }

  if (usesHeadlineLayout(style, effect)) {
    spec.fontCss = style === 'st-font-snap' && isHeadlineWord ? impactFont : baseFont;
    spec.fontWeight = isHeadlineWord ? 800 : 600;
    spec.fontStyle = 'normal';
    spec.color = isHeadlineWord ? accentColor : '#ffffff';
    spec.displayText = style !== 'st-minimal' && isHeadlineWord ? word.toUpperCase() : word;
    spec.scale = isHeadlineWord ? 1.32 : 0.86;
    spec.opacity = 1;
  }

  if (style === 'st-pop' && effect === 'flipUp') {
    spec.displayText = word.toUpperCase();
    spec.outlineColor = '#ffffff';
    spec.shadowMode = 'soft';
  } else if (style === 'st-minimal' && effect === 'flipUp') {
    spec.color = '#18181a';
    spec.shadowMode = 'none';
    spec.opacity = 1;
  } else if (style === 'st-editorial' && effect === 'maskSlide') {
    spec.color = '#fff3e1';
    spec.fontStyle = 'normal';
    spec.shadowMode = 'none';
    spec.scale = 1;
  } else if (style === 'st-typewriter' && effect === 'flipUp') {
    spec.displayText = word.toUpperCase();
    spec.color = '#ffffff';
    spec.backgroundColor = isOn ? accentColor : null;
    spec.borderRadiusEm = 0.14;
    spec.shadowMode = 'none';
  } else if (style === 'st-kinetic-mix' && effect === 'wave') {
    spec.displayText = word;
    spec.fontCss = '"Caveat", "Playfair Display", Georgia, cursive';
    spec.fontWeight = 700;
    spec.fontStyle = 'normal';
    spec.color = wordIndex % 2 === 0 ? accentColor : '#ffc1a9';
    spec.scale = isOn ? 1.1 : 1;
  } else if (style === 'st-highlight' && isOn) {
    const usesKeywordTag = effect === 'fadeIn' || effect === 'maskSlide';
    if (usesKeywordTag && !isSpotlightKey) {
      spec.backgroundColor = null;
      spec.color = '#ffffff';
      spec.shadowMode = 'outline';
    } else {
      spec.backgroundColor = accentColor;
      if (usesKeywordTag) spec.borderRadiusEm = 0.35;
    }
  }

  const energetic = effect === 'scaleUp' || effect === 'bounce';

  // Axis 1: Reveal Mode behavior
  if (effectiveReveal === 'pop') {
    spec.isHidden = !isOn;
    if (isOn) {
      spec.scale = Math.max(spec.scale, 1.35);
    }
  } else if (effectiveReveal === 'build') {
    if (isFuture) {
      spec.isHidden = true;
    }
  } else if (effectiveReveal === 'spotlight') {
    if (isSpotlightKey) {
      spec.isSpotlightKey = true;
      spec.scale = energetic ? Math.max(spec.scale, 1.25) : 1;
      spec.fontWeight = 800;
      if (spec.backgroundColor === null) spec.color = isNegative && !isOn ? '#fb7185' : accentColor;
    } else {
      if (!isOn) spec.opacity = Math.min(spec.opacity, 0.84);
      if (!energetic) spec.scale = 1;
      else if (!isOn) spec.scale = Math.min(spec.scale, 0.96);
    }
  } else if (isSpotlightKey && isNegative && !isOn && style !== 'st-hormozi') {
    spec.color = '#fb7185';
  }

  // Axis 2: Deterministic Frame-Time Entrance Effect
  const wordDuration = Math.max(0.18, cueDurationSec);
  const progress =
    cueElapsedSec <= 0.001
      ? 1
      : Math.max(0, Math.min(1, cueElapsedSec / Math.min(0.32, wordDuration * 0.55)));
  const easeOut = 1 - Math.pow(1 - progress, 3);

  if (effect === 'fadeIn') {
    spec.opacity *= 0.75 + 0.25 * easeOut;
  } else if (effect === 'scaleUp') {
    // Spring overshoot curve inspired by Reels / MrBeast pop
    const punch = progress < 1 ? 0.86 + Math.sin(progress * Math.PI * 0.85) * 0.28 : 1;
    spec.scale *= punch;
  } else if (effect === 'bounce') {
    if (isOn) {
      spec.translateYEm = Math.min(spec.translateYEm, -0.18);
      spec.scale = Math.max(spec.scale, 1.24);
    } else if (progress < 1) {
      spec.translateYEm += (1 - easeOut) * 0.22;
    }
  } else if (effect === 'maskSlide') {
    spec.translateYEm += (1 - easeOut) * 0.25;
    spec.opacity *= 0.75 + 0.25 * easeOut;
  } else if (effect === 'flipUp') {
    spec.translateYEm += (1 - easeOut) * 0.2;
    spec.rotateDeg += (1 - easeOut) * -5;
    spec.opacity *= 0.75 + 0.25 * easeOut;
  } else if (effect === 'wave') {
    spec.translateYEm += Math.sin(currentTimeSec * 6 + wordIndex * 0.95) * 0.11;
  } else if (effect === 'neonPulse') {
    spec.shadowMode = 'neon';
    const pulse = 0.94 + Math.sin(currentTimeSec * 5 + wordIndex * 0.4) * 0.08;
    spec.scale *= pulse;
  } else if (effect === 'typewriter') {
    if (isFuture) {
      spec.opacity = Math.min(spec.opacity, 0.22);
    } else if (isOn && cueElapsedSec > 0.001 && cueElapsedSec < 0.35) {
      const charCount = Math.max(1, Math.ceil(spec.displayText.length * Math.min(1, progress * 1.15)));
      spec.displayText = spec.displayText.slice(0, charCount);
    }
  } else if (effect === 'scramble') {
    if (isOn && cueElapsedSec > 0.001 && progress < 0.85) {
      const lockProgress = isPast ? 1 : isOn ? Math.min(1, progress + 0.3) : Math.min(1, progress);
      const tickSeed = Math.floor(currentTimeSec * 18) + wordIndex * 13;
      spec.displayText = scrambleString(spec.displayText, lockProgress, tickSeed);
    }
  } else if (effect === 'glitch') {
    if (cueElapsedSec > 0.001 && (progress < 0.7 || isOn)) {
      const jitterSeed = Math.sin((currentTimeSec * 31 + wordIndex * 17) * 2.1);
      spec.glitchDxPx = Math.round(jitterSeed * 3.5);
      spec.glitchColorShift = true;
    }
  }

  const keyBeat = energetic && isOn && (
    isHeadlineWord || (isSpotlightKey && (
      effectiveReveal === 'spotlight' || effectiveReveal === 'pop'
      || style === 'st-highlight' || style === 'st-hormozi'
    ))
  );
  if (keyBeat && wordElapsedSec != null && wordElapsedSec >= 0) {
    const duration = Math.max(0.09, Math.min(0.28, wordDurationSec));
    const progress = Math.min(1, wordElapsedSec / duration);
    const pulse = progress < 0.25 ? progress * 4 : Math.pow((1 - progress) / 0.75, 2);
    spec.scale *= 1 + 0.22 * pulse;
    spec.translateYEm -= 0.07 * pulse;
  }

  return spec;
}

export function createCueId(index?: number): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `cap_${Date.now().toString(36)}_${index ?? 0}_${rand}`;
}

export function formatSec(t: number): string {
  const safe = Number.isFinite(t) ? Math.max(0, t) : 0;
  return `${(Math.round(safe * 10) / 10).toFixed(1)}s`;
}

export function formatSrtTime(t: number): string {
  const clamped = Math.max(0, Number.isFinite(t) ? t : 0);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped % 1) * 1000);
  const pad = (n: number, len: number) => String(n).padStart(len, '0');
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms === 1000 ? 999 : ms, 3)}`;
}

export function formatVttTime(t: number): string {
  return formatSrtTime(t).replace(',', '.');
}

export function buildSrt(captions: CaptionCue[], trimStart = 0): string {
  return captions
    .filter((c) => c.text.trim().length > 0)
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c, idx) => {
      const startStr = formatSrtTime(c.start - trimStart);
      const endStr = formatSrtTime(Math.max(c.start - trimStart + 0.1, c.end - trimStart));
      return `${idx + 1}\n${startStr} --> ${endStr}\n${c.text.trim()}\n`;
    })
    .join('\n');
}

export function buildVtt(captions: CaptionCue[], trimStart = 0): string {
  const body = captions
    .filter((c) => c.text.trim().length > 0)
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c) => {
      const startStr = formatVttTime(c.start - trimStart);
      const endStr = formatVttTime(Math.max(c.start - trimStart + 0.1, c.end - trimStart));
      return `${startStr} --> ${endStr}\n${c.text.trim()}`;
    })
    .join('\n\n');
  return body ? `WEBVTT\n\n${body}\n` : 'WEBVTT\n\n';
}

export function buildPlainTranscript(captions: CaptionCue[]): string {
  return captions
    .filter((c) => c.text.trim().length > 0)
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c) => c.text.trim())
    .join('\n');
}

export function parseSrtTimestamp(raw: string): number {
  const m = raw.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

export function parseSrt(txt: string, trimStart = 0): CaptionCue[] {
  const blocks = txt.replace(/\r/g, '').split(/\n\s*\n/);
  const parsed: CaptionCue[] = [];
  blocks.forEach((block, i) => {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    const arrowIdx = lines.findIndex((l) => l.includes('-->'));
    if (arrowIdx < 0) return;
    const parts = lines[arrowIdx].split('-->');
    if (parts.length < 2) return;
    const start = Math.round((parseSrtTimestamp(parts[0]) + trimStart) * 100) / 100;
    const end = Math.round(Math.max(start + 0.3, parseSrtTimestamp(parts[1]) + trimStart) * 100) / 100;
    const text = lines.slice(arrowIdx + 1).join(' ').trim();
    if (!text) return;
    parsed.push({
      id: createCueId(i),
      start,
      end,
      text,
    });
  });
  return parsed;
}

export function captionsFromWords(
  words: TimedWord[],
  offset = 0,
  trimStart = 0,
  trimEnd = Number.POSITIVE_INFINITY,
  wordsPerPage: WordsPerPage = 'auto'
): CaptionCue[] {
  const tokens: WordTokenTimed[] = [];
  for (const word of words) {
    const text = (word.punctuated_word || word.word || word.text || '').trim();
    const start = Number(word.start) + offset;
    if (!text || !Number.isFinite(start) || start < trimStart - 0.05 || start > trimEnd + 0.05) continue;
    const rawEnd = Number(word.end) + offset;
    tokens.push({ text, start, end: Number.isFinite(rawEnd) ? Math.max(start + 0.01, rawEnd) : start + 0.25 });
  }

  const cueFromGroup = (group: WordTokenTimed[], index: number) => {
    const start = Math.round(group[0].start * 100) / 100;
    const end = Math.round(Math.max(start + 0.3, ...group.map(word => word.end)) * 100) / 100;
    return attachWordTiming({ id: createCueId(index), start, end, text: group.map(word => word.text).join(' ') }, group);
  };

  if (wordsPerPage !== 'auto') {
    return regroupCaptionsSmart(tokens.map((token, index) => cueFromGroup([token], index)), wordsPerPage, 0.75);
  }

  const groups: WordTokenTimed[][] = [];
  for (const token of tokens) {
    const group = groups[groups.length - 1];
    if (!group || group.length >= 5 || token.start - group[group.length - 1].end > 0.8 || token.end - group[0].start > 3.2) {
      groups.push([token]);
    } else {
      group.push(token);
    }
  }
  return groups.map(cueFromGroup);
}

export function captionsFromSegments(
  segments: TimedSegment[],
  offset = 0,
  trimStart = 0,
  trimEnd = Number.POSITIVE_INFINITY
): CaptionCue[] {
  const out: CaptionCue[] = [];
  for (const seg of segments) {
    const txt = (seg.text || '').trim();
    if (!txt) continue;
    const s = (Number(seg.start) || 0) + offset;
    const e = (Number(seg.end) || s + 1) + offset;
    if (e <= trimStart || s >= trimEnd) continue;

    const words = txt.split(/\s+/).filter(Boolean);
    const chunks = Math.max(1, Math.ceil(words.length / 5));
    const per = Math.max(0.6, (e - s) / chunks);
    for (let i = 0; i < words.length; i += 5) {
      const start = Math.round((s + (i / 5) * per) * 100) / 100;
      const end = Math.round(Math.min(e, s + (i / 5 + 1) * per) * 100) / 100;
      out.push({
        id: createCueId(out.length),
        start,
        end: Math.max(start + 0.3, end),
        text: words.slice(i, i + 5).join(' '),
      });
    }
  }
  return out;
}

export function captionsFromText(text: string, spanStart: number, spanEnd: number): CaptionCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks = Math.max(1, Math.ceil(words.length / 5));
  const totalSpan = Math.max(chunks * 0.8, spanEnd - spanStart);
  const per = totalSpan / chunks;
  const out: CaptionCue[] = [];
  for (let i = 0; i < words.length; i += 5) {
    const start = Math.round((spanStart + (i / 5) * per) * 100) / 100;
    const end = Math.round(Math.min(spanStart + totalSpan, spanStart + (i / 5 + 1) * per) * 100) / 100;
    out.push({
      id: createCueId(out.length),
      start,
      end: Math.max(start + 0.3, end),
      text: words.slice(i, i + 5).join(' '),
    });
  }
  return out;
}

export function findActiveCaption(captions: CaptionCue[], currentTime: number): CaptionCue | null {
  for (let i = 0; i < captions.length; i++) {
    const c = captions[i];
    if (currentTime >= c.start && currentTime < c.end) {
      return c;
    }
  }
  return null;
}

export function findStylePreviewCaption(captions: CaptionCue[], currentTime: number): CaptionCue {
  let closest = STYLE_PREVIEW_SAMPLE;
  let closestDistance = Infinity;
  for (const cue of captions) {
    if (!cue.text.trim()) continue;
    if (currentTime >= cue.start && currentTime < cue.end) return cue;
    const distance = Math.max(cue.start - currentTime, currentTime - cue.end, 0);
    if (distance < closestDistance) {
      closest = cue;
      closestDistance = distance;
    }
  }
  return closest;
}

export function findPreviousCaption(captions: CaptionCue[], activeCue: CaptionCue | null): CaptionCue | null {
  if (!activeCue) return null;
  const sorted = captions.slice().sort((a, b) => a.start - b.start);
  const idx = sorted.findIndex((c) => c.id === activeCue.id);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1];
  // Only stack immediately preceding line within 2.5s so distant dialogue doesn't stack awkwardly
  return activeCue.start - prev.end <= 2.5 ? prev : null;
}

export function getCaptionWordClock(caption: CaptionCue, currentTime: number, words = caption.text.trim().split(/\s+/).filter(Boolean)) {
  const duration = Math.max(0.1, caption.end - caption.start);
  const wordDuration = duration / Math.max(1, words.length);
  const elapsed = currentTime - caption.start;
  const timed = getTimedCaptionWords(caption, words);
  if (timed?.length) {
    let index = timed.length - 1;
    while (index > 0 && currentTime + 0.005 < timed[index].start) index--;
    const word = timed[index];
    return { index, elapsed: currentTime - word.start, duration: word.end - word.start };
  }
  const index = Math.max(0, Math.min(words.length - 1, Math.floor(elapsed / wordDuration)));
  return { index, elapsed: elapsed - index * wordDuration, duration: wordDuration };
}

export function getActiveWordIndex(caption: CaptionCue, currentTime: number): number {
  return getCaptionWordClock(caption, currentTime).index;
}

export function splitCaption(caption: CaptionCue): [CaptionCue, CaptionCue] | null {
  const words = caption.text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const mid = Math.ceil(words.length / 2);
  const timed = getTimedCaptionWords(caption, words);
  const tMid = Math.round((timed?.[mid]?.start ?? ((caption.start + caption.end) / 2)) * 100) / 100;
  const first: CaptionCue = {
    id: caption.id,
    start: caption.start,
    end: Math.max(caption.start + (timed ? 0.01 : 0.2), tMid),
    text: words.slice(0, mid).join(' '),
    keyWords: caption.keyWords,
  };
  const second: CaptionCue = {
    id: createCueId(mid),
    start: first.end,
    end: Math.max(first.end + 0.2, caption.end),
    text: words.slice(mid).join(' '),
    keyWords: caption.keyWords,
  };
  return timed ? [attachWordTiming(first, timed.slice(0, mid)), attachWordTiming(second, timed.slice(mid))] : [first, second];
}

export function shiftCaptions(
  captions: CaptionCue[],
  deltaSeconds: number,
  maxDuration?: number
): CaptionCue[] {
  return captions.map((c) => {
    const span = Math.max(0.2, c.end - c.start);
    let nextStart = Math.round(Math.max(0, c.start + deltaSeconds) * 100) / 100;
    let nextEnd = Math.round((nextStart + span) * 100) / 100;
    if (typeof maxDuration === 'number' && maxDuration > 0.2) {
      if (nextEnd > maxDuration) {
        nextEnd = Math.round(maxDuration * 100) / 100;
        nextStart = Math.round(Math.max(0, nextEnd - span) * 100) / 100;
      }
    }
    return { ...c, start: nextStart, end: Math.max(nextStart + 0.2, nextEnd) };
  });
}

export function mergeCaptionWithNext(captions: CaptionCue[], cueId: string): CaptionCue[] {
  const sorted = captions.slice().sort((a, b) => a.start - b.start);
  const idx = sorted.findIndex((c) => c.id === cueId);
  if (idx < 0 || idx >= sorted.length - 1) return captions;
  const current = sorted[idx];
  const next = sorted[idx + 1];
  const mergedKeys = Array.from(new Set([...(current.keyWords || []), ...(next.keyWords || [])]));
  const merged: CaptionCue = {
    id: current.id,
    start: current.start,
    end: Math.max(current.end, next.end),
    text: `${current.text.trim()} ${next.text.trim()}`.trim(),
    ...(mergedKeys.length > 0 || (current.keyWords && next.keyWords) ? { keyWords: mergedKeys } : {}),
  };
  const cue = current.wordTiming || next.wordTiming ? attachWordTiming(merged, cuesToTimedTokens([current, next])) : merged;
  return [...sorted.slice(0, idx), cue, ...sorted.slice(idx + 2)];
}

export function encodeWav16kMono(samples: Float32Array): Blob {
  const n = samples.length;
  const ab = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true);
  dv.setUint32(28, 32000, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, 'data');
  dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export function createSampleCaptions(): CaptionCue[] {
  return [
    { id: 'sample_1', start: 0.2, end: 2.2, text: 'Stop scrolling right now', keyWords: ['stop', 'now'] },
    { id: 'sample_2', start: 2.3, end: 4.5, text: 'Watch how 3x faster captions look', keyWords: ['3x', 'captions'] },
    { id: 'sample_3', start: 4.6, end: 6.7, text: 'Tap any word to Spotlight it', keyWords: ['spotlight'] },
    { id: 'sample_4', start: 6.8, end: 8.8, text: 'Export $0 watermark clips fast', keyWords: ['$0', 'export'] },
  ];
}

export interface CaptionHistoryState {
  past: CaptionCue[][];
  present: CaptionCue[];
  future: CaptionCue[][];
}

function cloneCues(cues: CaptionCue[]): CaptionCue[] {
  return cues.map((c) => ({
    ...c,
    ...(Array.isArray(c.keyWords) ? { keyWords: [...c.keyWords] } : {}),
    ...(c.wordTiming ? { wordTiming: c.wordTiming.map(word => ({ ...word })) } : {}),
  }));
}

function areCuesEqual(a: CaptionCue[], b: CaptionCue[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].start !== b[i].start ||
      a[i].end !== b[i].end ||
      a[i].text !== b[i].text ||
      JSON.stringify(a[i].keyWords) !== JSON.stringify(b[i].keyWords)
      || JSON.stringify(a[i].wordTiming) !== JSON.stringify(b[i].wordTiming)
    ) {
      return false;
    }
  }
  return true;
}

export function createCaptionHistory(initial: CaptionCue[]): CaptionHistoryState {
  return {
    past: [],
    present: cloneCues(initial),
    future: [],
  };
}

export function commitCaptionHistory(
  state: CaptionHistoryState,
  next: CaptionCue[],
  maxHistory = 40
): CaptionHistoryState {
  if (areCuesEqual(state.present, next)) return state;
  const nextPast = [...state.past, cloneCues(state.present)];
  const trimmedPast =
    nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast;
  return {
    past: trimmedPast,
    present: cloneCues(next),
    future: [],
  };
}

export function undoCaptionHistory(state: CaptionHistoryState): CaptionHistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: cloneCues(previous),
    future: [cloneCues(state.present), ...state.future],
  };
}

export function redoCaptionHistory(state: CaptionHistoryState): CaptionHistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return {
    past: [...state.past, cloneCues(state.present)],
    present: cloneCues(next),
    future: state.future.slice(1),
  };
}

export type DroppedFileKind = 'video' | 'srt' | 'unsupported';

export function classifyDroppedFile(file: Pick<File, 'name' | 'type'>): DroppedFileKind {
  const lowerName = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();
  if (lowerName.endsWith('.srt')) return 'srt';
  if (
    mime.startsWith('video/') ||
    /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(lowerName)
  ) {
    return 'video';
  }
  return 'unsupported';
}

export function createNextCue(
  captions: CaptionCue[],
  currentTime: number,
  trimStart: number,
  duration: number,
  hasVideo: boolean
): CaptionCue {
  let t = hasVideo ? currentTime : trimStart;
  const lastEnd = captions.length ? Math.max(...captions.map((c) => c.end)) : 0;
  const inside = captions.some((c) => t >= c.start && t < c.end);
  if ((!hasVideo && captions.length > 0) || (inside && lastEnd > t)) {
    t = lastEnd;
  }

  const start = Math.round(Math.max(0, t) * 10) / 10;
  let end = Math.round((start + 2) * 10) / 10;
  if (duration > 0) {
    end = Math.min(Math.round(duration * 10) / 10, end);
  }
  if (end <= start) {
    end = Math.round((start + 0.5) * 10) / 10;
  }

  return {
    id: createCueId(captions.length),
    start,
    end,
    text: '',
  };
}

export function snapCueStartToTime(
  cue: CaptionCue,
  playheadTime: number,
  duration?: number
): CaptionCue {
  const span = Math.max(0.4, cue.end - cue.start);
  const nextStart = Math.round(Math.max(0, playheadTime) * 10) / 10;
  let nextEnd = Math.round((nextStart + span) * 10) / 10;
  if (typeof duration === 'number' && duration > 0.4) {
    nextEnd = Math.min(Math.round(duration * 10) / 10, nextEnd);
  }
  if (nextEnd <= nextStart) {
    nextEnd = Math.round((nextStart + 0.5) * 10) / 10;
  }
  return { ...cue, start: nextStart, end: nextEnd };
}
