import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW_SEO_METADATA,
  buildCanonicalUrl,
  getViewSeoMetadata,
  type SeoViewId,
} from './seo';

test('VIEW_SEO_METADATA enforces recommended title and meta description length budgets', () => {
  const views: SeoViewId[] = ['landing', 'studio', 'projects', 'deploy', 'guide'];
  for (const view of views) {
    const meta = getViewSeoMetadata(view);
    assert.ok(
      meta.title.length >= 30 && meta.title.length <= 65,
      `Expected ${view} title length (30-65), got ${meta.title.length}: "${meta.title}"`
    );
    assert.ok(
      meta.description.length >= 110 && meta.description.length <= 165,
      `Expected ${view} description length (110-165), got ${meta.description.length}`
    );
  }
  assert.equal(Object.keys(VIEW_SEO_METADATA).length, views.length);
});

test('buildCanonicalUrl resolves clean canonical links per view', () => {
  assert.equal(
    buildCanonicalUrl('https://caption-lite.vercel.app/', '/', 'studio'),
    'https://caption-lite.vercel.app/'
  );
  assert.equal(
    buildCanonicalUrl('https://caption-lite.vercel.app', '/', 'guide'),
    'https://caption-lite.vercel.app/#guide'
  );
  assert.equal(
    buildCanonicalUrl('https://caption-lite.vercel.app', '/studio', 'deploy'),
    'https://caption-lite.vercel.app/studio#deploy'
  );
});
