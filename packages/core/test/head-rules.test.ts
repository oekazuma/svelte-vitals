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
    // warning, not critical (2026-08-09 P2 severity-alignment review, #9): critical is now
    // reserved for crash/security rules + title-presence; Google only "sometimes" uses the
    // meta description, so a missing one no longer fails the default `--fail-on critical` gate.
    expect(r!.severity).toBe('warning');
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
  it('seo/description-presence flags an empty description', async () => {
    const [r] = await seoDescriptionPresence.check(
      ctx([{ kind: 'meta', name: 'description', presence: 'own', value: 'absent' }])
    );
    expect(r!.detection).toEqual({ presence: 'own', value: 'absent' });
    expect(r!.message).toBe('Empty <meta name="description">');
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
  it('seo/json-ld reports own when an own tag matches alongside an inherited one (issue #443)', async () => {
    const [r] = await seoJsonLd.check(
      ctx([
        { kind: 'jsonld', presence: 'inherited', value: 'static' },
        { kind: 'jsonld', presence: 'own', value: 'static' }
      ])
    );
    expect(r!.detection.presence).toBe('own');
  });
  it('seo/json-ld reports inherited when only an inherited tag matches', async () => {
    const [r] = await seoJsonLd.check(ctx([{ kind: 'jsonld', presence: 'inherited', value: 'static' }]));
    expect(r!.detection.presence).toBe('inherited');
  });
  it('seo/json-ld reports the satisfying own tag regardless of order vs. an empty own tag', async () => {
    const [empty, valid] = [
      { kind: 'jsonld' as const, presence: 'own' as const, value: 'absent' as const },
      { kind: 'jsonld' as const, presence: 'own' as const, value: 'static' as const }
    ];
    const [before] = await seoJsonLd.check(ctx([empty, valid]));
    expect(before!.detection).toEqual({ presence: 'own', value: 'static' });
    const [after] = await seoJsonLd.check(ctx([valid, empty]));
    expect(after!.detection).toEqual({ presence: 'own', value: 'static' });
  });
  it('seo/json-ld reports a valid inherited document over an empty own script', async () => {
    const [r] = await seoJsonLd.check(
      ctx([
        { kind: 'jsonld', presence: 'inherited', value: 'static' },
        { kind: 'jsonld', presence: 'own', value: 'absent' }
      ])
    );
    expect(r!.detection).toEqual({ presence: 'inherited', value: 'static' });
  });
  it('seo/json-ld still reports Empty when every matching tag is empty', async () => {
    const [r] = await seoJsonLd.check(ctx([{ kind: 'jsonld', presence: 'own', value: 'absent' }]));
    expect(r!.detection).toEqual({ presence: 'own', value: 'absent' });
    expect(r!.message).toBe('Empty JSON-LD (<script type="application/ld+json">)');
  });
});
