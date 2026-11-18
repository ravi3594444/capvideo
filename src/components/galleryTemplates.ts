import {
  CAPTION_STYLE_CATALOG,
  CURATED_PRESET_PACKS,
  DEFAULT_STYLE_CONFIG,
  type CaptionCue,
  type CaptionStyle,
  type CaptionStyleCategory,
  type StyleConfig,
} from '../utils/captions';

interface TemplateSample {
  image: string;
  lines: [string, string];
  title?: string;
}

export interface GalleryTemplate {
  id: string;
  title: string;
  description: string;
  category: CaptionStyleCategory | 'preset';
  image: string;
  cues: [CaptionCue, CaptionCue];
  style: StyleConfig;
}

const styleSamples: Record<CaptionStyle, TemplateSample> = {
  'st-highlight': { image: 'city', lines: ['Pay attention now.', 'Watch this part.'] },
  'st-editorial': { image: 'alpine', lines: ['Somewhere quieter.', 'Stay a little longer.'] },
  'st-minimal': { image: 'forest', lines: ['Take the long way.', 'See what you find.'], title: 'Clean Subtitles' },
  'st-pop': { image: 'dog', lines: ['Stop. Look. Listen.', 'Ready. Set. Go.'] },
  'st-typewriter': { image: 'network', lines: ['Signal coming through.', 'Stay connected.'], title: 'Typewriter' },
  'st-cinema': { image: 'coast', lines: ['See you by the sea.', 'I’ll be waiting.'] },
  'st-classic': { image: 'architecture', lines: ['Look up.', 'It changes everything.'] },
  'st-font-switch': { image: 'flowers', lines: ['Make room for color.', 'Let it grow.'] },
  'st-font-snap': { image: 'hall', lines: ['Own the moment.', 'Make your move.'] },
  'st-kinetic-mix': { image: 'earth', lines: ['Find your rhythm.', 'Then switch it up.'] },
  'st-hormozi': { image: 'ridge', lines: ['Start before you’re ready.', 'Do the hard thing.'], title: 'Condensed Punch' },
  'st-cycle': { image: 'sunset', lines: ['Into the blue.', 'Out of the dark.'] },
  'st-karaoke': { image: 'river', lines: ['Follow the water.', 'All the way home.'] },
  'st-bounce': { image: 'hills', lines: ['Go a little higher.', 'One step at a time.'] },
  'st-neon': { image: 'lamp', lines: ['Light up the room.', 'Keep it glowing.'] },
};

const presetSamples: Record<string, TemplateSample> = {
  'pack-mrbeast': { image: 'dawn', lines: ['The race starts now.', 'Three seconds left.'] },
  'pack-spotlight': { image: 'leaves', lines: ['Small steps matter.', 'Big changes follow.'] },
  'pack-pop-word': { image: 'moors', lines: ['Wait. Think. Begin.', 'Ready. Set. Move.'], title: 'One-Word Pop Pack' },
  'pack-editorial': { image: 'interior', lines: ['A quiet morning.', 'A slow start.'] },
  'pack-difference': { image: 'clouds', lines: ['Above the clouds.', 'Nothing in the way.'] },
  'pack-cyber': { image: 'network', lines: ['Decrypt the signal.', 'Access granted.'] },
};

const featuredStyles: CaptionStyle[] = ['st-highlight', 'st-editorial', 'st-minimal', 'st-pop', 'st-typewriter', 'st-cinema'];
const styles = [
  ...featuredStyles.map((id) => CAPTION_STYLE_CATALOG.find((entry) => entry.id === id)!),
  ...CAPTION_STYLE_CATALOG.filter((entry) => !featuredStyles.includes(entry.id)),
];

const cueLength = 1.75;
export const galleryLoopDuration = cueLength * 2;

function sampleCues(id: string, [first, second]: TemplateSample['lines']): GalleryTemplate['cues'] {
  return [
    { id: `${id}-first`, start: 0, end: cueLength, text: first },
    { id: `${id}-second`, start: cueLength, end: galleryLoopDuration, text: second },
  ];
}

export const galleryTemplates: GalleryTemplate[] = [
  ...styles.map((style): GalleryTemplate => {
    const sample = styleSamples[style.id];
    return {
      id: style.id,
      title: sample.title ?? style.label,
      category: style.category,
      description: style.desc,
      image: sample.image,
      cues: sampleCues(style.id, sample.lines),
      style: {
        ...DEFAULT_STYLE_CONFIG,
        style: style.id,
        fontFamily: style.defaultFont ?? DEFAULT_STYLE_CONFIG.fontFamily,
        revealMode: style.defaultReveal,
        effect: style.defaultEffect,
      },
    };
  }),
  ...CURATED_PRESET_PACKS.map((pack): GalleryTemplate => {
    const sample = presetSamples[pack.id] ?? styleSamples[pack.apply.style ?? DEFAULT_STYLE_CONFIG.style];
    return {
      id: pack.id,
      title: sample.title ?? pack.label,
      category: 'preset',
      description: pack.subtitle,
      image: sample.image,
      cues: sampleCues(pack.id, sample.lines),
      style: { ...DEFAULT_STYLE_CONFIG, ...pack.apply },
    };
  }),
];
