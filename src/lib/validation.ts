import type {
  AspectRatio,
  CaptionBlendMode,
  CaptionFont,
  CaptionPosition,
  CaptionStyle,
  EntranceEffect,
  PageLayoutMode,
  RevealMode,
  WordsPerPage,
} from '../utils/captions';

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const MAX_ID_LENGTH = 128;
export const MAX_TITLE_LENGTH = 120;
export const MAX_CAPTION_TEXT_LENGTH = 500;
export const MAX_PRESET_NAME_LENGTH = 64;
export const MAX_DISPLAY_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_DURATION_SEC = 7200;
export const MAX_CAPTIONS_COUNT = 5000;
export const MAX_KEYWORDS_COUNT = 40;
export const MAX_KEYWORD_LENGTH = 64;

export const ALLOWED_ASPECTS: readonly AspectRatio[] = ['r916', 'r11', 'r169'];
export const ALLOWED_STYLES: readonly CaptionStyle[] = [
  'st-minimal',
  'st-editorial',
  'st-cinema',
  'st-classic',
  'st-font-switch',
  'st-font-snap',
  'st-kinetic-mix',
  'st-typewriter',
  'st-hormozi',
  'st-highlight',
  'st-pop',
  'st-cycle',
  'st-karaoke',
  'st-bounce',
  'st-neon',
  'st-behind-subject',
  'st-hero-moment',
];
export const ALLOWED_FONTS: readonly CaptionFont[] = [
  'manrope',
  'system',
  'editorial',
  'impact',
  'mono',
];
export const ALLOWED_POSITIONS: readonly CaptionPosition[] = ['pos-bottom', 'pos-third', 'pos-centre'];
export const ALLOWED_REVEALS: readonly RevealMode[] = ['karaoke', 'build', 'flash', 'pop', 'spotlight'];
export const ALLOWED_EFFECTS: readonly EntranceEffect[] = [
  'none',
  'fadeIn',
  'scaleUp',
  'bounce',
  'glitch',
  'typewriter',
  'scramble',
  'flipUp',
  'wave',
  'neonPulse',
  'maskSlide',
];
export const ALLOWED_WORDS_PER_PAGE: readonly WordsPerPage[] = ['auto', '2', '3', '4'];
export const ALLOWED_PAGE_LAYOUTS: readonly PageLayoutMode[] = ['replace', 'stack'];
export const ALLOWED_BLEND_MODES: readonly CaptionBlendMode[] = ['normal', 'difference'];

export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= MAX_ID_LENGTH && ID_PATTERN.test(id);
}

export function sanitizeTitle(raw: string): string {
  const trimmed = (raw || '').trim().slice(0, MAX_TITLE_LENGTH);
  return trimmed.length > 0 ? trimmed : 'Untitled Clip';
}

export function sanitizeCaptionText(raw: string): string {
  return (raw || '').slice(0, MAX_CAPTION_TEXT_LENGTH);
}

export function sanitizeKeyWords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (trimmed && !out.includes(trimmed)) {
      out.push(trimmed);
    }
    if (out.length >= MAX_KEYWORDS_COUNT) break;
  }
  return out;
}

export function sanitizePresetName(raw: string): string {
  const trimmed = (raw || '').trim().slice(0, MAX_PRESET_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : 'Custom Style';
}

export function sanitizeHexColor(raw: string): string {
  return HEX_COLOR_PATTERN.test(raw) ? raw : '#ffd60a';
}

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return 22;
  return Math.max(12, Math.min(48, Math.round(size)));
}

export function clampWordSpacingVal(spacing: number): number {
  if (!Number.isFinite(spacing)) return 0.26;
  return Math.round(Math.max(0.06, Math.min(0.9, spacing)) * 100) / 100;
}

export interface ProjectPayload {
  id: string;
  ownerId: string;
  title: string;
  aspectRatio: AspectRatio;
  duration: number;
  trimStart: number;
  trimEnd: number;
  language: string;
  style: CaptionStyle;
  fontFamily?: CaptionFont;
  position: CaptionPosition;
  accentColor: string;
  fontSize: number;
  wordSpacing?: number;
  revealMode?: RevealMode;
  effect?: EntranceEffect;
  wordsPerPage?: WordsPerPage;
  pageLayout?: PageLayoutMode;
  spotlightAuto?: boolean;
  blendMode?: CaptionBlendMode;
  audioCleanEnabled: boolean;
  captionsCount: number;
}

export interface CaptionPayload {
  id: string;
  projectId: string;
  ownerId: string;
  start: number;
  end: number;
  text: string;
  keyWords?: string[];
  orderIndex: number;
}

export interface PresetPayload {
  id: string;
  ownerId: string;
  name: string;
  style: CaptionStyle;
  fontFamily?: CaptionFont;
  position: CaptionPosition;
  accentColor: string;
  fontSize: number;
  wordSpacing?: number;
  revealMode?: RevealMode;
  effect?: EntranceEffect;
  wordsPerPage?: WordsPerPage;
  pageLayout?: PageLayoutMode;
  spotlightAuto?: boolean;
  blendMode?: CaptionBlendMode;
}

export function validateProjectPayload(p: unknown): { valid: boolean; reason?: string } {
  if (!p || typeof p !== 'object') return { valid: false, reason: 'Payload must be an object' };
  const record = p as Record<string, unknown>;
  const allowedKeys = new Set([
    'id',
    'ownerId',
    'title',
    'aspectRatio',
    'duration',
    'trimStart',
    'trimEnd',
    'language',
    'style',
    'fontFamily',
    'position',
    'accentColor',
    'fontSize',
    'wordSpacing',
    'revealMode',
    'effect',
    'wordsPerPage',
    'pageLayout',
    'spotlightAuto',
    'blendMode',
    'audioCleanEnabled',
    'captionsCount',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) return { valid: false, reason: `Unexpected field: ${key}` };
  }
  if (!isValidId(String(record.id || ''))) return { valid: false, reason: 'Invalid project id' };
  if (!isValidId(String(record.ownerId || ''))) return { valid: false, reason: 'Invalid ownerId' };
  if (typeof record.title !== 'string' || record.title.length < 1 || record.title.length > MAX_TITLE_LENGTH) {
    return { valid: false, reason: 'Invalid title length' };
  }
  if (!ALLOWED_ASPECTS.includes(record.aspectRatio as AspectRatio)) {
    return { valid: false, reason: 'Invalid aspectRatio' };
  }
  if (typeof record.duration !== 'number' || record.duration < 0 || record.duration > MAX_DURATION_SEC) {
    return { valid: false, reason: 'Invalid duration' };
  }
  if (
    typeof record.trimStart !== 'number' ||
    typeof record.trimEnd !== 'number' ||
    record.trimStart < 0 ||
    record.trimEnd < record.trimStart
  ) {
    return { valid: false, reason: 'Invalid trim window' };
  }
  if (typeof record.language !== 'string' || record.language.length < 2 || record.language.length > 32) {
    return { valid: false, reason: 'Invalid language' };
  }
  if (!ALLOWED_STYLES.includes(record.style as CaptionStyle)) return { valid: false, reason: 'Invalid style' };
  if (record.fontFamily !== undefined && !ALLOWED_FONTS.includes(record.fontFamily as CaptionFont)) {
    return { valid: false, reason: 'Invalid fontFamily' };
  }
  if (!ALLOWED_POSITIONS.includes(record.position as CaptionPosition)) {
    return { valid: false, reason: 'Invalid position' };
  }
  if (typeof record.accentColor !== 'string' || !HEX_COLOR_PATTERN.test(record.accentColor)) {
    return { valid: false, reason: 'Invalid accentColor' };
  }
  if (typeof record.fontSize !== 'number' || record.fontSize < 12 || record.fontSize > 48) {
    return { valid: false, reason: 'Invalid fontSize' };
  }
  if (
    record.wordSpacing !== undefined &&
    (typeof record.wordSpacing !== 'number' || record.wordSpacing < 0.05 || record.wordSpacing > 1.0)
  ) {
    return { valid: false, reason: 'Invalid wordSpacing' };
  }
  if (record.revealMode !== undefined && !ALLOWED_REVEALS.includes(record.revealMode as RevealMode)) {
    return { valid: false, reason: 'Invalid revealMode' };
  }
  if (record.effect !== undefined && !ALLOWED_EFFECTS.includes(record.effect as EntranceEffect)) {
    return { valid: false, reason: 'Invalid effect' };
  }
  if (
    record.wordsPerPage !== undefined &&
    !ALLOWED_WORDS_PER_PAGE.includes(record.wordsPerPage as WordsPerPage)
  ) {
    return { valid: false, reason: 'Invalid wordsPerPage' };
  }
  if (
    record.pageLayout !== undefined &&
    !ALLOWED_PAGE_LAYOUTS.includes(record.pageLayout as PageLayoutMode)
  ) {
    return { valid: false, reason: 'Invalid pageLayout' };
  }
  if (record.spotlightAuto !== undefined && typeof record.spotlightAuto !== 'boolean') {
    return { valid: false, reason: 'Invalid spotlightAuto' };
  }
  if (
    record.blendMode !== undefined &&
    !ALLOWED_BLEND_MODES.includes(record.blendMode as CaptionBlendMode)
  ) {
    return { valid: false, reason: 'Invalid blendMode' };
  }
  if (typeof record.audioCleanEnabled !== 'boolean') {
    return { valid: false, reason: 'Invalid audioCleanEnabled' };
  }
  if (
    typeof record.captionsCount !== 'number' ||
    record.captionsCount < 0 ||
    record.captionsCount > MAX_CAPTIONS_COUNT
  ) {
    return { valid: false, reason: 'Invalid captionsCount' };
  }
  return { valid: true };
}

export function validateCaptionPayload(c: unknown): { valid: boolean; reason?: string } {
  if (!c || typeof c !== 'object') return { valid: false, reason: 'Payload must be an object' };
  const record = c as Record<string, unknown>;
  const allowedKeys = new Set([
    'id',
    'projectId',
    'ownerId',
    'start',
    'end',
    'text',
    'keyWords',
    'orderIndex',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) return { valid: false, reason: `Unexpected field: ${key}` };
  }
  if (!isValidId(String(record.id || ''))) return { valid: false, reason: 'Invalid caption id' };
  if (!isValidId(String(record.projectId || ''))) return { valid: false, reason: 'Invalid projectId' };
  if (!isValidId(String(record.ownerId || ''))) return { valid: false, reason: 'Invalid ownerId' };
  if (typeof record.start !== 'number' || record.start < 0 || record.start > MAX_DURATION_SEC) {
    return { valid: false, reason: 'Invalid start time' };
  }
  if (typeof record.end !== 'number' || record.end < record.start || record.end > MAX_DURATION_SEC) {
    return { valid: false, reason: 'Invalid end time' };
  }
  if (typeof record.text !== 'string' || record.text.length > MAX_CAPTION_TEXT_LENGTH) {
    return { valid: false, reason: 'Invalid caption text' };
  }
  if (record.keyWords !== undefined) {
    if (!Array.isArray(record.keyWords) || record.keyWords.length > MAX_KEYWORDS_COUNT) {
      return { valid: false, reason: 'Invalid keyWords list' };
    }
    for (const kw of record.keyWords) {
      if (typeof kw !== 'string' || kw.length > MAX_KEYWORD_LENGTH) {
        return { valid: false, reason: 'Invalid keyWord item' };
      }
    }
  }
  if (typeof record.orderIndex !== 'number' || record.orderIndex < 0 || record.orderIndex > MAX_CAPTIONS_COUNT) {
    return { valid: false, reason: 'Invalid orderIndex' };
  }
  return { valid: true };
}
