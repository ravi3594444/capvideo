export type SeoViewId = 'landing' | 'studio' | 'projects' | 'deploy' | 'guide';

export interface ViewSeoMetadata {
  title: string;
  description: string;
  hashPath: string;
}

export const VIEW_SEO_METADATA: Record<SeoViewId, ViewSeoMetadata> = {
  landing: {
    title: 'Caption Lite — Make every word worth watching',
    description: 'Create and style captions for Reels, Shorts, and TikToks. Try animated fonts, edit in your browser, and export your video or subtitles.',
    hashPath: '',
  },
  studio: {
    title: 'Caption Lite — Free Video Captioning & Style Studio',
    description:
      'Caption, style, clean audio, and export watermark-free Reels, Shorts, and TikToks with Deepgram Nova-2, Inception Mercury 3, and Firebase sync.',
    hashPath: '',
  },
  projects: {
    title: 'Saved Projects & Style Presets — Caption Lite',
    description:
      'Manage your cloud-synced video caption timelines, aspect ratios, trim windows, and custom creator presets stored securely in Cloud Firestore.',
    hashPath: '#projects',
  },
  deploy: {
    title: 'Vercel API Keys & Firebase Setup — Caption Lite',
    description:
      'Configure DEEPGRAM_API_KEY and INCEPTION_API_KEY on Vercel alongside Firebase Authorized Domains for production server-proxied transcription.',
    hashPath: '#deploy',
  },
  guide: {
    title: 'How Caption Lite Works & FAQ — Caption Lite',
    description:
      'Learn how on-device Web Audio clean-up, reference color sampling, 16 kHz mono WAV compression, Deepgram Nova-2, and Mercury 3 work together.',
    hashPath: '#guide',
  },
};

export function getViewSeoMetadata(view: SeoViewId): ViewSeoMetadata {
  return VIEW_SEO_METADATA[view] ?? VIEW_SEO_METADATA.studio;
}

export function buildCanonicalUrl(origin: string, pathname: string, view: SeoViewId): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const meta = getViewSeoMetadata(view);
  return `${cleanOrigin}${cleanPath}${meta.hashPath}`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function applyDocumentSeo(view: SeoViewId): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const meta = getViewSeoMetadata(view);
  document.title = meta.title;

  upsertMeta('name', 'description', meta.description);
  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', meta.description);

  const canonicalUrl = buildCanonicalUrl(
    window.location.origin,
    window.location.pathname,
    view
  );
  upsertMeta('property', 'og:url', canonicalUrl);

  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', canonicalUrl);
}
