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
  | 'st-neon';

export type CaptionFont = 'manrope' | 'system' | 'editorial' | 'impact' | 'mono';
export type CaptionPosition = 'pos-bottom' | 'pos-third' | 'pos-centre';

export interface CaptionCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface StyleConfig {
  style: CaptionStyle;
  fontFamily: CaptionFont;
  position: CaptionPosition;
  accentColor: string;
  fontSize: number;
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
}

export const CAPTION_STYLE_CATALOG: CaptionStyleMeta[] = [
  {
    id: 'st-minimal',
    category: 'simple',
    label: 'Clean Normal',
    desc: 'Simple font, zero background color',
    noBackground: true,
  },
  {
    id: 'st-editorial',
    category: 'simple',
    label: 'Editorial Serif',
    desc: 'Graceful serif, subtle italic pulse',
    noBackground: true,
  },
  {
    id: 'st-cinema',
    category: 'simple',
    label: 'Cinema Matte',
    desc: 'Readable full-line translucent subtitle bar',
  },
  {
    id: 'st-classic',
    category: 'simple',
    label: 'Classic Outline',
    desc: 'Crisp white outline with yellow spoken cue',
  },
  {
    id: 'st-font-switch',
    category: 'font-switch',
    label: 'Serif Switch',
    desc: 'Active word shifts to italic serif on the beat',
    noBackground: true,
  },
  {
    id: 'st-font-snap',
    category: 'font-switch',
    label: 'Impact Switch',
    desc: 'Spoken word snaps to condensed uppercase display',
    noBackground: true,
  },
  {
    id: 'st-kinetic-mix',
    category: 'font-switch',
    label: 'Kinetic Trio',
    desc: 'Words alternate serif italic & mono at each beat',
    noBackground: true,
  },
  {
    id: 'st-typewriter',
    category: 'font-switch',
    label: 'Typewriter Reveal',
    desc: 'Monospace progressive reveal as words play',
  },
  {
    id: 'st-hormozi',
    category: 'creator',
    label: 'Bold Punch',
    desc: 'Thick uppercase condensed display + accent flash',
    noBackground: true,
  },
  {
    id: 'st-highlight',
    category: 'creator',
    label: 'Word Highlight',
    desc: 'Spoken word pops inside a bright yellow box',
  },
  {
    id: 'st-pop',
    category: 'creator',
    label: 'Scale Pop',
    desc: 'Spoken word scales up in accent color',
    noBackground: true,
  },
  {
    id: 'st-cycle',
    category: 'creator',
    label: 'Colour Cycle',
    desc: 'Each word cycles through bright palette colors',
  },
  {
    id: 'st-karaoke',
    category: 'creator',
    label: 'Karaoke Fill',
    desc: 'Sing-along progress fill as words play',
  },
  {
    id: 'st-bounce',
    category: 'creator',
    label: 'Elastic Bounce',
    desc: 'Dynamic upward bounce & tilt on spoken word',
    noBackground: true,
  },
  {
    id: 'st-neon',
    category: 'creator',
    label: 'Neon Glow',
    desc: 'Luminous word glow across palette',
    noBackground: true,
  },
];

export interface CaptionContainerSpec {
  hasFullLineBackdrop: boolean;
  backdropColor: string | null;
}

export function getCaptionContainerSpec(style: CaptionStyle): CaptionContainerSpec {
  if (style === 'st-cinema') {
    return {
      hasFullLineBackdrop: true,
      backdropColor: 'rgba(10, 10, 14, 0.78)',
    };
  }
  return {
    hasFullLineBackdrop: false,
    backdropColor: null,
  };
}

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
}

export function getWordVisualSpec(opts: {
  style: CaptionStyle;
  fontFamily?: CaptionFont;
  word: string;
  wordIndex: number;
  activeWordIndex: number;
  accentColor: string;
}): WordVisualSpec {
  const { style, fontFamily = 'manrope', word, wordIndex, activeWordIndex, accentColor } = opts;
  const isOn = wordIndex === activeWordIndex;
  const baseFont = getCaptionFontStack(fontFamily);
  const serifFont = '"Playfair Display", Georgia, serif';
  const impactFont = '"Oswald", Impact, sans-serif';
  const monoFont = '"JetBrains Mono", ui-monospace, monospace';

  switch (style) {
    case 'st-minimal':
      return {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 600,
        fontStyle: 'normal',
        color: isOn ? '#ffffff' : 'rgba(255, 255, 255, 0.92)',
        backgroundColor: null,
        opacity: isOn ? 1 : 0.92,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };

    case 'st-editorial':
      return {
        displayText: word,
        fontCss: serifFont,
        fontWeight: 700,
        fontStyle: isOn ? 'italic' : 'normal',
        color: isOn ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.08 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };

    case 'st-cinema':
      return {
        displayText: word,
        fontCss: baseFont,
        fontWeight: isOn ? 700 : 500,
        fontStyle: 'normal',
        color: isOn ? '#ffffff' : '#e4e4e7',
        backgroundColor: null,
        opacity: 1,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'none',
      };

    case 'st-font-switch':
      return {
        displayText: word,
        fontCss: isOn ? serifFont : baseFont,
        fontWeight: isOn ? 700 : 600,
        fontStyle: isOn ? 'italic' : 'normal',
        color: isOn ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.18 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };

    case 'st-font-snap':
      return {
        displayText: isOn ? word.toUpperCase() : word,
        fontCss: isOn ? impactFont : baseFont,
        fontWeight: isOn ? 700 : 500,
        fontStyle: 'normal',
        color: isOn ? accentColor : 'rgba(255, 255, 255, 0.92)',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.2 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: isOn ? 'heavy-outline' : 'soft',
      };

    case 'st-kinetic-mix': {
      const useMono = isOn && wordIndex % 2 === 1;
      const useSerif = isOn && wordIndex % 2 === 0;
      return {
        displayText: useMono ? word.toUpperCase() : word,
        fontCss: useMono ? monoFont : useSerif ? serifFont : baseFont,
        fontWeight: isOn ? 700 : 600,
        fontStyle: useSerif ? 'italic' : 'normal',
        color: isOn ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.18 : 1,
        translateYEm: isOn ? -0.05 : 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };
    }

    case 'st-typewriter':
      return {
        displayText: word,
        fontCss: monoFont,
        fontWeight: isOn ? 700 : 500,
        fontStyle: 'normal',
        color: isOn ? accentColor : '#ffffff',
        backgroundColor: isOn ? 'rgba(255, 255, 255, 0.14)' : null,
        opacity: wordIndex > activeWordIndex ? 0.28 : 1,
        scale: 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };

    case 'st-hormozi':
      return {
        displayText: word.toUpperCase(),
        fontCss: impactFont,
        fontWeight: 700,
        fontStyle: 'normal',
        color: isOn ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.22 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'heavy-outline',
      };

    case 'st-pop':
      return {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: isOn ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.18 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: 'soft',
      };

    case 'st-cycle':
      return {
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

    case 'st-karaoke':
      return {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: isOn
          ? '#111111'
          : wordIndex < activeWordIndex
            ? CAP_PALETTE[wordIndex % CAP_PALETTE.length]
            : '#ffffff',
        backgroundColor: isOn ? accentColor : null,
        opacity: !isOn && wordIndex > activeWordIndex ? 0.92 : 1,
        scale: isOn ? 1.14 : 1,
        translateYEm: 0,
        rotateDeg: 0,
        shadowMode: isOn ? 'none' : 'outline',
      };

    case 'st-bounce':
      return {
        displayText: word,
        fontCss: baseFont,
        fontWeight: 800,
        fontStyle: 'normal',
        color: isOn ? accentColor : '#ffffff',
        backgroundColor: null,
        opacity: 1,
        scale: isOn ? 1.34 : 1,
        translateYEm: isOn ? -0.14 : 0,
        rotateDeg: isOn ? -2 : 0,
        shadowMode: 'soft',
      };

    case 'st-neon':
      return {
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

    case 'st-classic':
    case 'st-highlight':
    default:
      return {
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
  }
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
  trimEnd = Number.POSITIVE_INFINITY
): CaptionCue[] {
  const out: { start: number; end: number; words: string[] }[] = [];
  let cur: { start: number; end: number; words: string[] } | null = null;

  for (const w of words) {
    const token = (w.punctuated_word || w.word || w.text || '').trim();
    if (!token) continue;
    const s = (Number(w.start) || 0) + offset;
    const e = (Number(w.end) || s + 0.25) + offset;
    if (s < trimStart - 0.05 || s > trimEnd + 0.05) continue;

    if (!cur || cur.words.length >= 5 || s - cur.end > 0.8 || e - cur.start > 3.2) {
      if (cur) out.push(cur);
      cur = { start: s, end: e, words: [token] };
    } else {
      cur.words.push(token);
      cur.end = Math.max(cur.end, e);
    }
  }
  if (cur) out.push(cur);

  return out.map((c, idx) => {
    const start = Math.round(c.start * 100) / 100;
    const end = Math.round(Math.max(c.end, start + 0.3) * 100) / 100;
    return {
      id: createCueId(idx),
      start,
      end,
      text: c.words.join(' '),
    };
  });
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

export function getActiveWordIndex(caption: CaptionCue, currentTime: number): number {
  const words = caption.text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const duration = Math.max(0.1, caption.end - caption.start);
  const progress = Math.max(0, Math.min(0.9999, (currentTime - caption.start) / duration));
  return Math.min(words.length - 1, Math.floor(progress * words.length));
}

export function splitCaption(caption: CaptionCue): [CaptionCue, CaptionCue] | null {
  const words = caption.text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const mid = Math.ceil(words.length / 2);
  const tMid = Math.round((caption.start + (caption.end - caption.start) / 2) * 100) / 100;
  const first: CaptionCue = {
    id: caption.id,
    start: caption.start,
    end: Math.max(caption.start + 0.2, tMid),
    text: words.slice(0, mid).join(' '),
  };
  const second: CaptionCue = {
    id: createCueId(mid),
    start: first.end,
    end: Math.max(first.end + 0.2, caption.end),
    text: words.slice(mid).join(' '),
  };
  return [first, second];
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
  const merged: CaptionCue = {
    id: current.id,
    start: current.start,
    end: Math.max(current.end, next.end),
    text: `${current.text.trim()} ${next.text.trim()}`.trim(),
  };
  return [...sorted.slice(0, idx), merged, ...sorted.slice(idx + 2)];
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
    { id: 'sample_1', start: 0.2, end: 2.2, text: 'Stop scrolling right now' },
    { id: 'sample_2', start: 2.3, end: 4.5, text: 'Watch how clean dynamic captions look' },
    { id: 'sample_3', start: 4.6, end: 6.7, text: 'Tap any word to fix spelling' },
    { id: 'sample_4', start: 6.8, end: 8.8, text: 'Export without watermarks in seconds' },
  ];
}

export interface CaptionHistoryState {
  past: CaptionCue[][];
  present: CaptionCue[];
  future: CaptionCue[][];
}

function cloneCues(cues: CaptionCue[]): CaptionCue[] {
  return cues.map((c) => ({ ...c }));
}

function areCuesEqual(a: CaptionCue[], b: CaptionCue[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].start !== b[i].start ||
      a[i].end !== b[i].end ||
      a[i].text !== b[i].text
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


