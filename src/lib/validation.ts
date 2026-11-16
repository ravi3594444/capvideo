import type { AspectRatio, CaptionFont, CaptionPosition, CaptionStyle } from '../utils/captions';

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
];
export const ALLOWED_FONTS: readonly CaptionFont[] = [
  'manrope',
  'system',
  'editorial',
  'impact',
  'mono',
];
export const ALLOWED_POSITIONS: readonly CaptionPosition[] = ['pos-bottom', 'pos-third', 'pos-centre'];

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
  const allowedKeys = new Set(['id', 'projectId', 'ownerId', 'start', 'end', 'text', 'orderIndex']);
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
  if (typeof record.orderIndex !== 'number' || record.orderIndex < 0 || record.orderIndex > MAX_CAPTIONS_COUNT) {
    return { valid: false, reason: 'Invalid orderIndex' };
  }
  return { valid: true };
}
