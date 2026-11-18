import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW_SEO_METADATA,
  buildCanonicalUrl,
  getViewSeoMetadata,
  isIndexable,
  resolveView,
  type SeoViewId,
} from './seo';

test('VIEW_SEO_METADATA enforces recommended title and meta description length budgets', () => {
  const views: SeoViewId[] = ['landing', 'gallery', 'studio', 'projects', 'deploy', 'guide'];
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

test('public pages use absolute canonical URLs without fragments', () => {
  assert.equal(buildCanonicalUrl('https://caption.example/', 'landing'), 'https://caption.example/');
  assert.equal(buildCanonicalUrl('https://caption.example', 'guide'), 'https://caption.example/guide');
  assert.equal(buildCanonicalUrl('https://caption.example', 'gallery'), 'https://caption.example/gallery');
  assert.equal(isIndexable('projects'), false);
  assert.equal(isIndexable('deploy'), false);
  assert.equal(isIndexable('studio'), false);
});

test('resolveView keeps old links working while using standalone routes', () => {
  assert.equal(resolveView('/', '#guide'), 'guide');
  assert.equal(resolveView('/', '#projects'), 'projects');
  assert.equal(resolveView('/', '#styles'), 'landing');
  assert.equal(resolveView('/guide/', ''), 'guide');
  assert.equal(resolveView('/gallery', ''), 'gallery');
  assert.equal(resolveView('/missing', ''), undefined);
});
