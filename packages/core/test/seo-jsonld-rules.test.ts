import { describe, it, expect } from 'vitest';
import {
  seoJsonLdValidity,
  seoJsonLdDeprecatedType,
  seoJsonLdRelativeUrl,
  seoJsonLdDateFormat,
  seoJsonLdPlaceholder,
  seoJsonLdRequiredProps
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
const fails = (rs: Awaited<ReturnType<typeof seoJsonLdValidity.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

describe('seo/json-ld-validity validity', () => {
  it('flags invalid JSON', async () => {
    expect(fails(await seoJsonLdValidity.check(ctx(headWithJsonLd('{bad'))))).toHaveLength(1);
  });
  it('flags missing @context', async () => {
    expect(fails(await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@type":"WebPage"}'))))).toHaveLength(1);
  });
  it('flags missing @type', async () => {
    expect(fails(await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org"}'))))).toHaveLength(
      1
    );
  });
  it('passes valid JSON-LD', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"WebPage"}'))
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('skips a dynamic (uncaptured) JSON-LD', async () => {
    expect(await seoJsonLdValidity.check(ctx(headWithJsonLd(undefined)))).toHaveLength(0);
  });
});

describe('seo/json-ld-validity: unknown @type vocabulary', () => {
  it('flags an unknown root type', async () => {
    const rs = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Zebra123"}')))
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toBe("Unknown @type 'Zebra123' — not a schema.org type.");
  });

  it('suggests the canonical name for a case-only mismatch', async () => {
    const rs = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"article"}')))
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toBe("Unknown @type 'article' — not a schema.org type. Did you mean 'Article'?");
  });

  it('suggests the closest name for a distance-1 typo (dropped letter)', async () => {
    const rs = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Artcle"}')))
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toBe("Unknown @type 'Artcle' — not a schema.org type. Did you mean 'Article'?");
  });

  it('suggests the closest name for a distance-2 typo (transposition)', async () => {
    // measured: levenshtein('artilce', 'article') === 2
    const rs = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Artilce"}')))
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toBe("Unknown @type 'Artilce' — not a schema.org type. Did you mean 'Article'?");
  });

  it('suggests the closest name for a distance-2 typo (dropped letters)', async () => {
    // measured: levenshtein('artcl', 'article') === 2
    const rs = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Artcl"}')))
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toBe("Unknown @type 'Artcl' — not a schema.org type. Did you mean 'Article'?");
  });

  it('gives no suggestion when nothing in the catalog is within distance 2', async () => {
    // measured: closest catalog name to 'zebra999' is 'Library' at distance 5; to 'xyzzy' is 'City' at distance 4
    const rs1 = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Zebra999"}')))
    );
    expect(rs1[0]?.message).toBe("Unknown @type 'Zebra999' — not a schema.org type.");

    const rs2 = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"xyzzy"}')))
    );
    expect(rs2[0]?.message).toBe("Unknown @type 'xyzzy' — not a schema.org type.");
  });

  it('breaks a distance tie by sorted catalog order', async () => {
    // measured: 'bMRadioChannel' is distance 1 from both 'AMRadioChannel' and 'FMRadioChannel';
    // 'AMRadioChannel' sorts first.
    const rs = fails(
      await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"bMRadioChannel"}')))
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toBe(
      "Unknown @type 'bMRadioChannel' — not a schema.org type. Did you mean 'AMRadioChannel'?"
    );
  });

  it('passes known types including a nested entity type, unchanged', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person"}}'))
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });

  it('flags an unknown nested type even when the root type is known', async () => {
    const rs = fails(
      await seoJsonLdValidity.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","author":{"@type":"Persn"}}'))
      )
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toContain("'Persn'");
  });

  it('flags only the unknown member of a multi-@type array', async () => {
    const rs = fails(
      await seoJsonLdValidity.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":["Product","Vehicl"]}'))
      )
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toContain("'Vehicl'");
  });

  it('does not flag an IRI-form @type', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"https://schema.org/Article"}'))
    );
    expect(fails(rs)).toHaveLength(0);
  });

  it('does not flag a prefixed-form @type', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"schema:Article"}'))
    );
    expect(fails(rs)).toHaveLength(0);
  });

  it('exempts a document whose @context is not schema.org (base validity result unaffected)', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":"https://example.com/vocab","@type":"Zebra123"}'))
    );
    expect(fails(rs)).toHaveLength(0); // no vocabulary finding — base checks still see @context+@type present
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toBe('JSON-LD validity');
  });

  it('exempts an array @context that includes a non-schema.org member', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":["https://schema.org","https://example.com/vocab"],"@type":"Zebra123"}'))
    );
    expect(fails(rs)).toHaveLength(0);
  });

  it('exempts an object @context', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":{"schema":"https://schema.org/"},"@type":"Zebra123"}'))
    );
    expect(fails(rs)).toHaveLength(0);
  });

  it('validates http:// and trailing-slash schema.org context forms', async () => {
    expect(
      fails(await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"http://schema.org","@type":"Zebra123"}'))))
    ).toHaveLength(1);
    expect(
      fails(await seoJsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org/","@type":"Zebra123"}'))))
    ).toHaveLength(1);
  });

  it('exempts an uppercase schema.org context (case-sensitive match)', async () => {
    const rs = await seoJsonLdValidity.check(
      ctx(headWithJsonLd('{"@context":"HTTPS://SCHEMA.ORG","@type":"Zebra123"}'))
    );
    expect(fails(rs)).toHaveLength(0);
  });

  it('flags each unknown name in a multi-@type array as its own finding', async () => {
    const rs = fails(
      await seoJsonLdValidity.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":["Zebra123","Quokka456"]}'))
      )
    );
    expect(rs).toHaveLength(2);
    expect(rs.map((r) => r.message).sort()).toEqual([
      "Unknown @type 'Quokka456' — not a schema.org type.",
      "Unknown @type 'Zebra123' — not a schema.org type."
    ]);
  });

  it('flags an unknown @graph member type exactly once, despite root+@graph flattening', async () => {
    const rs = fails(
      await seoJsonLdValidity.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@graph":[{"@type":"Zebra123","name":"x"}]}'))
      )
    );
    expect(rs).toHaveLength(1);
  });
});

describe('seo/json-ld-deprecated-type-021', () => {
  it('seo/json-ld-deprecated-type flags a deprecated type', async () => {
    expect(
      fails(
        await seoJsonLdDeprecatedType.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"HowTo"}')))
      )
    ).toHaveLength(1);
  });
  it('seo/json-ld-relative-url flags a relative URL under a known key', async () => {
    expect(
      fails(
        await seoJsonLdRelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","image":"/logo.png"}'))
        )
      )
    ).toHaveLength(1);
    expect(
      fails(
        await seoJsonLdRelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","image":"https://e.com/l.png"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-relative-url does not flag a relative @id (node identifier, not a URL)', async () => {
    expect(
      fails(
        await seoJsonLdRelativeUrl.check(
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
        await seoJsonLdRelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","logo":"//cdn.e.com/l.png"}'))
        )
      )
    ).toHaveLength(0);
    expect(
      fails(
        await seoJsonLdRelativeUrl.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","image":"data:image/png;base64,AAAA"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-date-format flags a non-ISO date under a known key', async () => {
    expect(
      fails(
        await seoJsonLdDateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","datePublished":"June 1, 2026"}'))
        )
      )
    ).toHaveLength(1);
    expect(
      fails(
        await seoJsonLdDateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","datePublished":"2026-06-01"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-date-format accepts schema.org reduced-precision dates (year / year-month)', async () => {
    expect(
      fails(
        await seoJsonLdDateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Event","startDate":"2026"}'))
        )
      )
    ).toHaveLength(0);
    expect(
      fails(
        await seoJsonLdDateFormat.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Event","startDate":"2026-06"}'))
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-placeholder flags placeholder text', async () => {
    expect(
      fails(
        await seoJsonLdPlaceholder.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Org","name":"Your Company Name"}'))
        )
      )
    ).toHaveLength(1);
  });
  it('seo/json-ld-required-props flags a missing required property and ignores unknown types', async () => {
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Product","name":"x"}'))
        )
      )
    ).toHaveLength(1); // missing one of review/aggregateRating/offers
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Product","name":"x","offers":{}}'))
        )
      )
    ).toHaveLength(0);
    expect(
      await seoJsonLdRequiredProps.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"CustomThing","foo":1}'))
      )
    ).toHaveLength(0); // unknown type → no signal
  });
  it('seo/json-ld-required-props treats an empty/blank required value as missing', async () => {
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Recipe","name":"x","image":""}'))
        )
      )
    ).toHaveLength(1); // blank image → still missing
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}'))
        )
      )
    ).toHaveLength(1); // empty array → still missing
  });
  it('seo/json-ld-required-props: Article/BlogPosting/NewsArticle/Organization have no required props (Google: none) — no finding at all, not even a pass', async () => {
    expect(
      await seoJsonLdRequiredProps.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Article","author":"x"}'))
      )
    ).toHaveLength(0); // no headline, and no signal either — the row was removed, not satisfied
    expect(
      await seoJsonLdRequiredProps.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Organization","logo":"https://e.com/l.png"}'))
      )
    ).toHaveLength(0); // no name/url, and no signal either
  });
  it('seo/json-ld-required-props: Product passes with name + any single one of review/aggregateRating/offers', async () => {
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(
            headWithJsonLd(
              '{"@context":"https://schema.org","@type":"Product","name":"x","aggregateRating":{"ratingValue":"4.5"}}'
            )
          )
        )
      )
    ).toHaveLength(0); // aggregateRating alone satisfies the one-of group
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(
            headWithJsonLd(
              '{"@context":"https://schema.org","@type":"Product","name":"x","review":{"reviewBody":"great"}}'
            )
          )
        )
      )
    ).toHaveLength(0); // review alone satisfies the one-of group
  });
  it('seo/json-ld-required-props: Product missing all of review/aggregateRating/offers names the group in the message', async () => {
    const rs = fails(
      await seoJsonLdRequiredProps.check(
        ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Product","name":"x"}'))
      )
    );
    expect(rs).toHaveLength(1);
    expect(rs[0]?.message).toContain('one of review, aggregateRating or offers');
  });
  it('seo/json-ld-required-props: Recipe requires only name + image (not recipeIngredient/recipeInstructions)', async () => {
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(
            headWithJsonLd(
              '{"@context":"https://schema.org","@type":"Recipe","name":"x","image":"https://e.com/d.jpg"}'
            )
          )
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-required-props: VideoObject does not require description (Google: Recommended)', async () => {
    expect(
      fails(
        await seoJsonLdRequiredProps.check(
          ctx(
            headWithJsonLd(
              '{"@context":"https://schema.org","@type":"VideoObject","name":"x","thumbnailUrl":"https://e.com/t.jpg","uploadDate":"2026-01-01"}'
            )
          )
        )
      )
    ).toHaveLength(0);
  });
  it('seo/json-ld-required-props: a generic Person node emits no required-props finding (no standalone Person rich result; the name/alternateName requirement is scoped to ProfilePage.mainEntity, which this per-node engine does not track)', async () => {
    expect(
      await seoJsonLdRequiredProps.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"Person"}')))
    ).toHaveLength(0);
  });
  it('seo/json-ld-deprecated-type-021 skip parseable JSON-LD that seo/json-ld-validity deems invalid (missing @context/@type)', async () => {
    // Relative URL present, but no @context → seo/json-ld-validity owns the finding; seo/json-ld-relative-url stays silent (no misleading pass).
    expect(await seoJsonLdRelativeUrl.check(ctx(headWithJsonLd('{"@type":"Org","image":"/logo.png"}')))).toHaveLength(
      0
    );
    // @context but no @type → likewise skipped.
    expect(
      await seoJsonLdRequiredProps.check(ctx(headWithJsonLd('{"@context":"https://schema.org","name":"x"}')))
    ).toHaveLength(0);
  });
});
