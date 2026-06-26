import { describe, it, expect } from 'vitest';
import {
  seo016JsonLdValidity,
  seo017DeprecatedType,
  seo018RelativeUrl,
  seo019DateFormat,
  seo020Placeholder,
  seo021RequiredProps
} from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { RuleContext } from '../src/rule.js';

const headWithJsonLd = (raw?: string): ResolvedHead => ({
  route: '/x',
  source: 'rendered',
  file: 'x',
  tags: [
    { kind: 'jsonld', presence: 'own', value: raw ? 'static' : 'dynamic', ...(raw ? { jsonld: raw } : {}) } as HeadTag
  ]
});
const ctx = (head: ResolvedHead): RuleContext => ({ heads: [head], project: defaultProject, config: defineConfig({}) });
const fails = (rs: Awaited<ReturnType<typeof seo016JsonLdValidity.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

describe('SEO016 validity', () => {
  it('flags invalid JSON', async () => {
    expect(fails(await seo016JsonLdValidity.check(ctx(headWithJsonLd('{bad'))))).toHaveLength(1);
  });
  it('flags missing @context', async () => {
    expect(fails(await seo016JsonLdValidity.check(ctx(headWithJsonLd('{"@type":"WebPage"}'))))).toHaveLength(1);
  });
  it('flags missing @type', async () => {
    expect(
      fails(await seo016JsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org"}'))))
    ).toHaveLength(1);
  });
  it('passes valid JSON-LD', async () => {
    const rs = await seo016JsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"WebPage"}'))
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('skips a dynamic (uncaptured) JSON-LD', async () => {
    expect(await seo016JsonLdValidity.check(ctx(headWithJsonLd(undefined)))).toHaveLength(0);
  });
});

describe('SEO017-021', () => {
  it('SEO017 flags a deprecated type', async () => {
    expect(
      fails(await seo017DeprecatedType.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"HowTo"}'))))
    ).toHaveLength(1);
  });
  it('SEO018 flags a relative URL under a known key', async () => {
    expect(
      fails(await seo018RelativeUrl.check(ctx(headWithJsonLd('{"@type":"Org","image":"/logo.png"}'))))
    ).toHaveLength(1);
    expect(
      fails(await seo018RelativeUrl.check(ctx(headWithJsonLd('{"@type":"Org","image":"https://e.com/l.png"}'))))
    ).toHaveLength(0);
  });
  it('SEO019 flags a non-ISO date under a known key', async () => {
    expect(
      fails(await seo019DateFormat.check(ctx(headWithJsonLd('{"@type":"Article","datePublished":"June 1, 2026"}'))))
    ).toHaveLength(1);
    expect(
      fails(await seo019DateFormat.check(ctx(headWithJsonLd('{"@type":"Article","datePublished":"2026-06-01"}'))))
    ).toHaveLength(0);
  });
  it('SEO020 flags placeholder text', async () => {
    expect(
      fails(await seo020Placeholder.check(ctx(headWithJsonLd('{"@type":"Org","name":"Your Company Name"}'))))
    ).toHaveLength(1);
  });
  it('SEO021 flags a missing required property and ignores unknown types', async () => {
    expect(fails(await seo021RequiredProps.check(ctx(headWithJsonLd('{"@type":"Product","name":"x"}'))))).toHaveLength(
      1
    ); // missing offers
    expect(
      fails(await seo021RequiredProps.check(ctx(headWithJsonLd('{"@type":"Product","name":"x","offers":{}}'))))
    ).toHaveLength(0);
    expect(await seo021RequiredProps.check(ctx(headWithJsonLd('{"@type":"CustomThing","foo":1}')))).toHaveLength(0); // unknown type → no signal
  });
});
