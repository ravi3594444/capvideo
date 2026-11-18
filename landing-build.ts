import fs from 'node:fs';
import { LANDING_EXAMPLES } from './src/utils/landingExamples.ts';
import { PRODUCT_SUMMARY } from './src/utils/publicContent.ts';

export function renderLanding(html: string, head: string, escape: (value: string) => string): string {
  const styles = fs.readFileSync(new URL('./src/landing.css', import.meta.url), 'utf8');
  const examples = LANDING_EXAMPLES.map(([, alt, caption, style, format], index) => {
    const angle = index / LANDING_EXAMPLES.length * 360;
    const position = `${index % 5 * 25}% ${Math.floor(index / 5) * 100 / 3}%`;
    return `<button class="showcase-card" type="button" aria-pressed="false"
      aria-label="${escape(`${style} captions: ${caption.replace('|', ' ')}. ${alt}`)}"
      style="--angle:${angle}deg;--position:${position}">
      <span class="showcase-flip" aria-hidden="true">
        <span class="showcase-front"><span class="showcase-caption showcase-caption--${format}">
          ${caption.split('|').map((line) => `<span>${escape(line)}</span>`).join('')}
        </span></span>
        <span class="showcase-back">${escape(style)}</span>
      </span>
    </button>`;
  }).join('');

  const analytics = process.env.VERCEL === '1' ? `
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
      addEventListener('load', () => {
        const script = document.createElement('script');
        script.src = '/_vercel/insights/script.js';
        document.head.append(script);
      }, { once: true });` : '';

  const content = `
    <header class="home-header">
      <a class="home-brand" href="/"><span aria-hidden="true">CC</span> Caption Lite</a>
      <nav aria-label="Main navigation"><a href="/gallery">Gallery</a><a href="/projects">Projects</a><a href="/guide">Help</a></nav>
      <a class="home-account" href="/projects">My account</a>
    </header>
    <main>
      <section class="showcase" aria-labelledby="landing-title">
        <div class="showcase-copy">
          <h1 id="landing-title">Add captions<br>to your videos.</h1>
          <p>Style captions for Reels, Shorts, and TikToks.</p>
          <div class="showcase-actions"><a class="home-button" href="/gallery">Open Gallery <span aria-hidden="true">→</span></a>
            <a href="#styles">See caption styles <span aria-hidden="true">↓</span></a></div>
        </div>
        <div class="showcase-ring" id="styles" role="group" aria-label="Caption style examples">${examples}</div>
        <a class="showcase-scroll" href="#features">↓ Scroll to explore</a>
      </section>
      <section class="home-features" id="features" aria-labelledby="features-title">
        <h2 id="features-title">Free online video caption editor</h2>
        <p>${escape(PRODUCT_SUMMARY)} <a href="/guide">Learn how to add captions</a>.</p>
        <div class="home-feature-grid">
          <article><h3>Add captions</h3><p>Type a line, paste your script, import an SRT, or generate captions from speech.</p></article>
          <article><h3>Find your style</h3><p>Choose a font, set the rhythm, and highlight the words you want people to remember.</p></article>
          <article><h3>Export your way</h3><p>Download a captioned video or take your subtitles into another editor.</p></article>
        </div>
        <a class="home-button" href="/gallery">Start editing <span aria-hidden="true">→</span></a>
        <a class="home-studio" href="/studio">Open the video caption studio</a>
      </section>
    </main>
    <script>
      function openLegacyPage() {
        const route = location.hash.slice(1);
        if (['studio', 'projects', 'deploy', 'guide'].includes(route)) {
          location.replace('/' + route + location.search);
        }
      }
      openLegacyPage();
      addEventListener('hashchange', openLegacyPage);
      document.querySelector('.showcase-ring').addEventListener('click', (event) => {
        const card = event.target.closest('.showcase-card');
        if (card) card.setAttribute('aria-pressed', card.getAttribute('aria-pressed') !== 'true');
      });
      document.querySelector('.showcase-actions a[href="#styles"]').addEventListener('click', () => {
        document.querySelector('.showcase-card').focus({ preventScroll: true });
      });
      ${analytics}
    </script>`;

  // Use the shared HTML shell while keeping Vite's editor assets off the homepage.
  return html
    .replace(/<script\b[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link\b[^>]*\brel="(?:stylesheet|modulepreload|preconnect)"[^>]*>/g, '')
    .replace('<!-- PAGE_HEAD -->', () => `${head}\n    <style>${styles}</style>`)
    .replace('<!-- PAGE_CONTENT -->', () => content);
}
