export type SeoViewId = 'landing' | 'gallery' | 'studio' | 'projects' | 'deploy' | 'guide';

export const VIEW_HREFS: Record<SeoViewId, string> = {
  landing: '/',
  gallery: '/gallery',
  studio: '/studio',
  projects: '/projects',
  deploy: '/deploy',
  guide: '/guide',
};

export const INDEXABLE_VIEWS = ['landing', 'gallery', 'guide'] as const;

export interface ViewSeoMetadata {
  title: string;
  description: string;
}

export const VIEW_SEO_METADATA: Record<SeoViewId, ViewSeoMetadata> = {
  landing: {
    title: 'Free Online Video Caption Editor | Caption Lite',
    description: 'Add animated captions to Reels, Shorts, and TikToks. Edit subtitles in your browser and export watermark-free WebM, SRT, or WebVTT.',
  },
  gallery: {
    title: 'Video Caption Templates and Styles | Caption Lite',
    description: 'Explore animated caption styles for Reels, TikTok, and YouTube Shorts. Preview styles on a sample clip and start a video caption project.',
  },
  studio: {
    title: 'Video Caption Editing Studio | Caption Lite',
    description: 'Edit subtitle timing, style animated words, crop and trim clips, and download a captioned WebM video or a separate subtitle file.',
  },
  projects: {
    title: 'Saved Caption Projects and Styles | Caption Lite',
    description: 'Sign in to open your saved video caption projects and custom styles, including subtitle timing, aspect ratios, and trim settings.',
  },
  deploy: {
    title: 'Vercel and Firebase Deployment Guide | Caption Lite',
    description: 'Check the server capabilities and configure Firebase, transcription, caption refinement, and private uploads for a Caption Lite deployment.',
  },
  guide: {
    title: 'How to Add Captions to a Video | Caption Lite',
    description: 'Learn how to add animated captions to a video, import and edit an SRT file, choose a caption style, and export subtitles or a watermark-free WebM.',
  },
};

export function getViewSeoMetadata(view: SeoViewId): ViewSeoMetadata {
  return VIEW_SEO_METADATA[view];
}

export function isIndexable(view: SeoViewId): boolean {
  return INDEXABLE_VIEWS.some((publicView) => publicView === view);
}

export function buildCanonicalUrl(origin: string, view: SeoViewId): string {
  return new URL(VIEW_HREFS[view], origin).href;
}

export function resolveView(pathname: string, hash: string): SeoViewId | undefined {
  const path = pathname.replace(/\/$/, '') || '/';
  const legacyHash = hash.slice(1);
  if (path === '/' && (legacyHash === 'projects' || legacyHash === 'deploy' || legacyHash === 'guide' || legacyHash === 'studio')) {
    return legacyHash;
  }
  return (Object.keys(VIEW_HREFS) as SeoViewId[]).find((view) => VIEW_HREFS[view] === path);
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

  upsertMeta('name', 'robots', isIndexable(view) ? 'index, follow' : 'noindex, follow');

  const siteOrigin = import.meta.env.VITE_SITE_URL;
  const canonicalUrl = siteOrigin ? buildCanonicalUrl(siteOrigin, view) : undefined;
  const existingLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const existingOgUrl = document.head.querySelector('meta[property="og:url"]');
  if (!canonicalUrl || !isIndexable(view)) {
    existingLink?.remove();
    existingOgUrl?.remove();
    return;
  }

  upsertMeta('property', 'og:url', canonicalUrl);
  const link = existingLink ?? document.createElement('link');
  link.rel = 'canonical';
  link.href = canonicalUrl;
  if (!existingLink) document.head.appendChild(link);
}
