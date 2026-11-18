import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { buildCanonicalUrl, getViewSeoMetadata, INDEXABLE_VIEWS, isIndexable, resolveView, VIEW_HREFS, type SeoViewId } from './src/utils/seo.ts';
import { CAPTION_FAQ, CAPTION_STEPS, PRODUCT_SUMMARY } from './src/utils/publicContent.ts';

import { renderLanding } from './landing-build.ts';
import { galleryTemplates } from './src/components/galleryTemplates.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export function getSiteOrigin(value: string | undefined): string | undefined {
  if (!value) return;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('VITE_SITE_URL must be a production HTTPS origin, for example https://example.com');
  }
  return url.origin;
}

export function seoPages(outDir: string, origin?: string, verification?: string): Plugin {
  const publicLinks = INDEXABLE_VIEWS.map((view) =>
    `<li><a href="${VIEW_HREFS[view]}">${escape(getViewSeoMetadata(view).title.split(' | ')[0])}</a></li>`
  ).join('');
  const fallback = {
    gallery: `<p>Preview animated captions on a sample clip and choose a style for your video. Open the studio to adjust font, placement, and timing.</p>
      <h2>Caption style examples</h2><dl>${galleryTemplates.slice(0, 8).map(({ title, description }) => `<dt>${escape(title)}</dt><dd>${escape(description)}</dd>`).join('')}</dl>`,
    guide: `<p>${escape(PRODUCT_SUMMARY)}</p><h2>Step-by-step workflow</h2><ol>${CAPTION_STEPS.map((step) => `<li>${escape(step)}</li>`).join('')}</ol>
      <h2>Frequently asked questions</h2>${CAPTION_FAQ.map(({ question, answer }) => `<h3>${escape(question)}</h3><p>${escape(answer)}</p>`).join('')}`,
  };

  function render(html: string, view: SeoViewId): string {
    const { title, description } = getViewSeoMetadata(view);
    const indexed = isIndexable(view);
    const canonical = indexed && origin ? buildCanonicalUrl(origin, view) : undefined;
    const image = origin ? new URL('/assets/gallery/podcast.webp', origin).href : undefined;
    const app = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Caption Lite',
      url: canonical,
      description: PRODUCT_SUMMARY,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web browser',
      inLanguage: 'en',
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      featureList: ['Animated video captions', 'SRT import', 'Watermark-free WebM export', 'SRT and WebVTT export'],
    };
    let head = [
      `<title>${escape(title)}</title>`,
      `<meta name="description" content="${escape(description)}">`,
      `<meta name="robots" content="${indexed ? 'index, follow' : 'noindex, follow'}">`,
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Caption Lite">',
      `<meta property="og:title" content="${escape(title)}">`,
      `<meta property="og:description" content="${escape(description)}">`,
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
      `<meta name="twitter:title" content="${escape(title)}">`,
      `<meta name="twitter:description" content="${escape(description)}">`,
      image ? `<meta property="og:image" content="${escape(image)}"><meta name="twitter:image" content="${escape(image)}">` : '',
      canonical ? `<link rel="canonical" href="${escape(canonical)}"><meta property="og:url" content="${escape(canonical)}">` : '',
      verification && view === 'landing' ? `<meta name="google-site-verification" content="${escape(verification)}">` : '',
      view === 'landing' ? `<script type="application/ld+json">${JSON.stringify(app).replace(/</g, '\\u003c')}</script>` : '',
    ].filter(Boolean).join('\n    ');
    if (view === 'landing') return renderLanding(html, head, escape);

    // Keep the crawlable HTML available when scripts are disabled. A running
    // browser shows the app's loading surface until React replaces both nodes.
    head += `
      <style>
        .app-loading { display: none; }
        [data-app-booting] #root > .indexable-summary { display: none; }
        [data-app-booting] #root > .app-loading {
          display: block;
          min-height: 100svh;
          background: #000;
        }
        .app-loading::before {
          content: '';
          display: block;
          height: 64px;
          background: #121212;
          border-bottom: 1px solid #282828;
        }
        @media (max-width: 600px) { .app-loading::before { height: 82px; } }
      </style>
      <script>
        document.documentElement.dataset.appBooting = '';
        window.addEventListener('error', (event) => {
          if (event.target instanceof HTMLScriptElement && event.target.type === 'module') {
            delete document.documentElement.dataset.appBooting;
          }
        }, true);
      </script>`;

    const content = indexed
      ? `<main class="indexable-summary"><h1>${escape(title.split(' | ')[0])}</h1>${fallback[view as keyof typeof fallback]}
        <p><a href="/studio">Open the video caption studio</a></p><nav aria-label="Caption Lite pages"><ul>${publicLinks}</ul></nav></main>`
      : '';
    return html.replace('<!-- PAGE_HEAD -->', () => head).replace('<!-- PAGE_CONTENT -->', () => `<div class="app-loading" role="status" aria-label="Loading Caption Lite"></div>${content}`);
  }

  return {
    name: 'caption-lite-seo',
    transformIndexHtml: { order: 'post', handler(html, ctx) {
      if (ctx.server) {
        const url = new URL(ctx.originalUrl ?? ctx.path, 'http://localhost');
        return render(html, resolveView(url.pathname, '') ?? 'landing');
      }
    } },
    closeBundle() {
      const file = path.join(outDir, 'index.html');
      if (!fs.existsSync(file)) return;
      const html = fs.readFileSync(file, 'utf8');
      if (!html.includes('<!-- PAGE_HEAD -->')) return;
      for (const [view, href] of Object.entries(VIEW_HREFS) as [SeoViewId, string][]) {
        fs.writeFileSync(path.join(outDir, href === '/' ? 'index.html' : `${href.slice(1)}.html`), render(html, view));
      }
      if (origin) {
        const urls = INDEXABLE_VIEWS.map((view) => `  <url><loc>${escape(buildCanonicalUrl(origin, view))}</loc></url>`);
        fs.writeFileSync(path.join(outDir, 'sitemap.xml'), [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls, '</urlset>', '',
        ].join('\n'));
        fs.appendFileSync(path.join(outDir, 'robots.txt'), `\nSitemap: ${origin}/sitemap.xml\n`);
        const llmsPath = path.join(outDir, 'llms.txt');
        fs.writeFileSync(llmsPath, fs.readFileSync(llmsPath, 'utf8').replace(/\]\(\//g, `](${origin}/`));
      }
    },
  };
}
