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

describe('seo/json-ld-validity validity', () => {
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

describe('seo/json-ld-deprecated-type-021', () => {
  it('seo/json-ld-deprecated-type flags a deprecated type', async () => {
    expect(
      fails(await seo017DeprecatedType.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"HowTo"}'))))
    ).toHaveLength(1);
  });
  it('seo/json-ld-relative-url flags a relative URL under a known key', async () => {
    expect(
      fails(
        await seo018RelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","image":"/logo.png"}'))
        )
      )
    ).toHaveLength(1);
    expect(
      fails(
        await seo018RelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","image":"https://e.com/l.png"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-relative-url does not flag a relative @id (node identifier, not a URL)', async () => {
    expect(
      fails(
        await seo018RelativeUrl.check(
          ctx(
            headWithJsonLd(
              '{"@context":"https://schema.org","@type":"Org","@id":"#organization","url":"https://e.com"}'
            )
          )
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-relative-url accepts protocol-relative and data-URI values', async () => {
    expect(
      fails(
        await seo018RelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","logo":"//cdn.e.com/l.png"}'))
        )
      )
    ).toHaveLength(0);
    expect(
      fails(
        await seo018RelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","image":"data:image/png;base64,AAAA"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-date-format flags a non-ISO date under a known key', async () => {
    expect(
      fails(
        await seo019DateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","datePublished":"June 1, 2026"}'))
        )
      )
    ).toHaveLength(1);
    expect(
      fails(
        await seo019DateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","datePublished":"2026-06-01"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-date-format accepts schema.org reduced-precision dates (year / year-month)', async () => {
    expect(
      fails(
        await seo019DateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Event","startDate":"2026"}'))
        )
      )
    ).toHaveLength(0);
    expect(
      fails(
        await seo019DateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Event","startDate":"2026-06"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-placeholder flags placeholder text', async () => {
    expect(
      fails(
        await seo020Placeholder.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","name":"Your Company Name"}'))
        )
      )
    ).toHaveLength(1);
  });
  it('seo/json-ld-required-props flags a missing required property and ignores unknown types', async () => {
    expect(
      fails(
        await seo021RequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Product","name":"x"}'))
        )
      )
    ).toHaveLength(1); // missing offers
    expect(
      fails(
        await seo021RequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Product","name":"x","offers":{}}'))
        )
      )
    ).toHaveLength(0);
    expect(
      await seo021RequiredProps.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"CustomThing","foo":1}'))
      )
    ).toHaveLength(0); // unknown type → no signal
  });
  it('seo/json-ld-required-props treats an empty/blank required value as missing', async () => {
    expect(
      fails(
        await seo021RequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","headline":""}'))
        )
      )
    ).toHaveLength(1); // blank headline → still missing
    expect(
      fails(
        await seo021RequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}'))
        )
      )
    ).toHaveLength(1); // empty array → still missing
  });
  it('seo/json-ld-deprecated-type-021 skip parseable JSON-LD that seo/json-ld-validity deems invalid (missing @context/@type)', async () => {
    // Relative URL present, but no @context → seo/json-ld-validity owns the finding; seo/json-ld-relative-url stays silent (no misleading pass).
    expect(await seo018RelativeUrl.check(ctx(headWithJsonLd('{"@type":"Org","image":"/logo.png"}')))).toHaveLength(0);
    // @context but no @type → likewise skipped.
    expect(
      await seo021RequiredProps.check(ctx(headWithJsonLd('{"@context":"https://schema.org","name":"x"}')))
    ).toHaveLength(0);
  });
});
