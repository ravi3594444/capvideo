import {
  CAPTION_FONT_OPTIONS,
  CAPTION_STYLE_CATALOG,
  DEFAULT_STYLE_CONFIG,
  type AspectRatio,
  type CaptionCue,
  type CaptionFont,
  type CaptionPosition,
  type CaptionStyle,
  type StyleConfig,
} from './captions';

export const DRAFT_STORAGE_KEY = 'caption-lite:studio-draft:v1';

export interface StudioDraft {
  projectTitle: string;
  aspect: AspectRatio;
  language: string;
  loopClip: boolean;
  styleConfig: StyleConfig;
  captions: CaptionCue[];
  updatedAt: number;
}

const VALID_ASPECTS = new Set<AspectRatio>(['r916', 'r11', 'r169']);
const VALID_STYLES = new Set<CaptionStyle>(CAPTION_STYLE_CATALOG.map((s) => s.id));
const VALID_FONTS = new Set<CaptionFont>(CAPTION_FONT_OPTIONS.map((f) => f.id));
const VALID_POSITIONS = new Set<CaptionPosition>(['pos-bottom', 'pos-third', 'pos-centre']);

export function serializeStudioDraft(draft: StudioDraft): string {
  return JSON.stringify(draft);
}

export function parseStudioDraft(raw: string | null): StudioDraft | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StudioDraft> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.captions)) return null;

    const cleanCaptions: CaptionCue[] = [];
    for (let i = 0; i < parsed.captions.length && cleanCaptions.length < 500; i++) {
      const item = parsed.captions[i] as Partial<CaptionCue> | null;
      if (!item || typeof item !== 'object') continue;
      const start = Number(item.start);
      const end = Number(item.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      cleanCaptions.push({
        id: typeof item.id === 'string' && item.id.trim() ? item.id.slice(0, 80) : `draft_${i}`,
        start: Math.max(0, start),
        end: Math.max(Math.max(0, start) + 0.1, end),
        text: typeof item.text === 'string' ? item.text.slice(0, 500) : '',
      });
    }

    const rawStyle = parsed.styleConfig as Partial<StyleConfig> | undefined;
    const styleConfig: StyleConfig = {
      style:
        rawStyle && VALID_STYLES.has(rawStyle.style as CaptionStyle)
          ? (rawStyle.style as CaptionStyle)
          : DEFAULT_STYLE_CONFIG.style,
      fontFamily:
        rawStyle && VALID_FONTS.has(rawStyle.fontFamily as CaptionFont)
          ? (rawStyle.fontFamily as CaptionFont)
          : DEFAULT_STYLE_CONFIG.fontFamily,
      position:
        rawStyle && VALID_POSITIONS.has(rawStyle.position as CaptionPosition)
          ? (rawStyle.position as CaptionPosition)
          : DEFAULT_STYLE_CONFIG.position,
      accentColor:
        rawStyle &&
        typeof rawStyle.accentColor === 'string' &&
        /^#[0-9a-f]{6}$/i.test(rawStyle.accentColor)
          ? rawStyle.accentColor
          : DEFAULT_STYLE_CONFIG.accentColor,
      fontSize:
        rawStyle && typeof rawStyle.fontSize === 'number' && Number.isFinite(rawStyle.fontSize)
          ? Math.min(38, Math.max(14, Math.round(rawStyle.fontSize)))
          : DEFAULT_STYLE_CONFIG.fontSize,
    };

    return {
      projectTitle:
        typeof parsed.projectTitle === 'string' && parsed.projectTitle.trim()
          ? parsed.projectTitle.slice(0, 120)
          : 'Untitled Reel',
      aspect: VALID_ASPECTS.has(parsed.aspect as AspectRatio)
        ? (parsed.aspect as AspectRatio)
        : 'r916',
      language:
        typeof parsed.language === 'string' && parsed.language.trim()
          ? parsed.language.slice(0, 32)
          : 'en-US',
      loopClip: Boolean(parsed.loopClip),
      styleConfig,
      captions: cleanCaptions,
      updatedAt:
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export function loadLocalDraft(): StudioDraft | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseStudioDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveLocalDraft(draft: StudioDraft): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, serializeStudioDraft(draft));
  } catch {
    // ignore storage quota restrictions
  }
}

export function clearLocalDraft(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
