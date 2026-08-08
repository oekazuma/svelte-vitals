import { describe, it, expect } from 'vitest';
import {
  seoDescriptionPresence,
  seoCanonicalUrl,
  seoOgImage,
  seoOgTitle,
  seoJsonLd,
  defaultProject,
  defineConfig,
  type ResolvedHead
} from '../src/index.js';

const config = defineConfig({});
const ctx = (tags: ResolvedHead['tags']) => ({
  heads: [{ route: '/x', source: 'static' as const, file: 'src/routes/x/+page.svelte', tags }],
  project: defaultProject,
  config
});

describe('head-tag rules', () => {
  it('seo/description-presence flags a missing description', async () => {
    const [r] = await seoDescriptionPresence.check(ctx([]));
    expect(r!.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(r!.severity).toBe('critical');
  });
  it('seo/description-presence passes a present description', async () => {
    const [r] = await seoDescriptionPresence.check(
      ctx([{ kind: 'meta', name: 'description', presence: 'own', value: 'static' }])
    );
    expect(r!.detection).toEqual({ presence: 'own', value: 'static' });
    // Already true before design 2026-08-08-pass-result-location-design.md (spike test-plan
    // item 2) — headTagRule sets `location: head.file` unconditionally, on both branches.
    expect(r!.location).toBe('src/routes/x/+page.svelte');
  });
  it('seo/canonical-url matches link rel=canonical', async () => {
    const [r] = await seoCanonicalUrl.check(
      ctx([{ kind: 'link', rel: 'canonical', presence: 'own', value: 'dynamic' }])
    );
    expect(r!.detection.value).toBe('dynamic');
    expect(r!.severity).toBe('warning');
  });
  it('seo/og-image/005 match og:image/og:title by property', async () => {
    const [img] = await seoOgImage.check(
      ctx([{ kind: 'meta', property: 'og:image', presence: 'own', value: 'static' }])
    );
    expect(img!.detection.presence).toBe('own');
    const [title] = await seoOgTitle.check(ctx([]));
    expect(title!.detection).toEqual({ presence: 'none', value: 'absent' });
  });
  it('seo/json-ld is info severity and matches jsonld', async () => {
    const [r] = await seoJsonLd.check(ctx([{ kind: 'jsonld', presence: 'own', value: 'static' }]));
    expect(r!.severity).toBe('info');
    expect(r!.detection.presence).toBe('own');
  });
});
