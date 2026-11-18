import {
  CAPTION_STYLE_CATALOG,
  CURATED_PRESET_PACKS,
  DEFAULT_STYLE_CONFIG,
  type CaptionCue,
  type CaptionStyleCategory,
  type StyleConfig,
} from '../utils/captions.ts';

export interface GalleryTemplate {
  id: string;
  title: string;
  description: string;
  category: CaptionStyleCategory | 'preset';
  style: StyleConfig;
}

const preferredLooks = [
  'pack-color-spotlight', 'pack-behind-subject', 'pack-hero-moment', 'pack-headline-beat', 'pack-lavender-note', 'pack-comic-beat',
  'pack-amber-stack', 'pack-quiet-reveal', 'pack-marker-mix',
  'pack-electric-blue', 'pack-white-label', 'pack-editorial-strip',
  'pack-dispatch', 'pack-red-stamp',
];

function lookPriority(id: string) {
  const position = preferredLooks.indexOf(id);
  return position < 0 ? preferredLooks.length : position;
}

export const galleryTemplates: GalleryTemplate[] = [
  ...CAPTION_STYLE_CATALOG.filter(({ id }) => id !== 'st-behind-subject' && id !== 'st-hero-moment').map((entry): GalleryTemplate => ({
    id: entry.id,
    title: entry.id === 'st-hormozi' ? 'Condensed Punch' : entry.label,
    category: entry.category,
    description: entry.desc,
    style: {
      ...DEFAULT_STYLE_CONFIG,
      style: entry.id,
      fontFamily: entry.defaultFont ?? DEFAULT_STYLE_CONFIG.fontFamily,
      revealMode: entry.defaultReveal,
      effect: entry.defaultEffect,
    },
  })),
  ...CURATED_PRESET_PACKS.map((pack): GalleryTemplate => ({
    id: pack.id,
    title: pack.id === 'pack-pop-word' ? 'One-Word Pop Pack'
      : pack.id === 'pack-mrbeast' ? 'Condensed Punch Pack'
      : pack.label,
    category: 'preset',
    description: pack.subtitle,
    style: { ...DEFAULT_STYLE_CONFIG, ...pack.apply },
  })),
].sort((first, second) => lookPriority(first.id) - lookPriority(second.id));

export const galleryPreviewCues: CaptionCue[] = [
  { id: 'preview-opening', start: 0, end: 2.3, text: 'Make every word count.', keyWords: ['word'] },
  { id: 'preview-middle', start: 2.3, end: 4.6, text: 'Give it a rhythm.', keyWords: ['rhythm'] },
  { id: 'preview-closing', start: 4.6, end: 7, text: 'Make it yours.', keyWords: ['yours'] },
];
