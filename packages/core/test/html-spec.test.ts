import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectHtmlSpec, resolveHtmlSpec } from '../scripts/html-spec.js';
import { HTML_SPEC, HTML_SPEC_VERSION } from '../src/html-spec/generated.js';
import { isKnownAriaAttribute, isKnownRole } from '../src/rules/a11y/aria-data.js';

const REGENERATE = 'run `pnpm --filter @svelte-vitals/core run gen:html-spec`';
const generatedPath = fileURLToPath(new URL('../src/html-spec/generated.ts', import.meta.url));

function installed() {
  const { jsonPath, version } = resolveHtmlSpec();
  return { raw: JSON.parse(readFileSync(jsonPath, 'utf8')), version };
}

describe('html-spec: the committed projection is up to date', () => {
  it('equals a fresh projection of the installed @markuplint/html-spec', () => {
    const { raw } = installed();
    expect(HTML_SPEC, REGENERATE).toEqual(projectHtmlSpec(raw));
  });

  it('carries the installed version', () => {
    expect(HTML_SPEC_VERSION, REGENERATE).toBe(installed().version);
    expect(readFileSync(generatedPath, 'utf8').split('\n', 2).join('\n')).toContain(
      `@markuplint/html-spec@${HTML_SPEC_VERSION}`
    );
  });
});

describe('html-spec: what the projection must and must not carry', () => {
  it('keeps no `required` on any ARIA role row — that question belongs to aria-query', () => {
    for (const row of Object.values(HTML_SPEC.aria.roles)) {
      for (const p of row.ownedProperties) expect(Object.keys(p).sort()).not.toContain('required');
    }
  });

  it('keeps the per-attribute required columns, which are a different fact', () => {
    expect(HTML_SPEC.elements.img!.attributes.src!.requiredEither).toContain('srcset');
  });

  it('opens with the upstream copyright line in a legal comment', () => {
    const head = readFileSync(generatedPath, 'utf8').slice(0, 400);
    const copyright = resolveHtmlSpec()
      .license.split('\n')
      .find((l) => l.startsWith('Copyright'))!;
    expect(head.startsWith('/*!')).toBe(true);
    expect(head).toContain(copyright);
  });
});

describe('html-spec: core purity', () => {
  it('the generated module and its neighbours import nothing from node:', () => {
    const dir = fileURLToPath(new URL('../src/html-spec/', import.meta.url));
    for (const f of readdirSync(dir)) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/from 'node:|require\('node:/);
    }
  });
});

describe('html-spec: the two ARIA sources cannot silently disagree about what exists', () => {
  it('every role and property markuplint names is one aria-data recognizes', () => {
    const { raw } = installed();
    const a13 = raw.def['#aria']['1.3'];
    const unknownRoles = [...a13.roles, ...a13.graphicsRoles]
      .map((r: { name: string }) => r.name)
      .filter((n: string) => !isKnownRole(n));
    const unknownProps = new Set<string>();
    for (const p of a13.props) if (!isKnownAriaAttribute(p.name)) unknownProps.add(p.name);
    for (const r of [...a13.roles, ...a13.graphicsRoles]) {
      for (const p of r.ownedProperties ?? []) if (!isKnownAriaAttribute(p.name)) unknownProps.add(p.name);
      for (const n of r.prohibitedProperties ?? []) if (!isKnownAriaAttribute(n)) unknownProps.add(n);
    }
    const unknownElementRoles = new Set<string>();
    for (const el of Object.values(HTML_SPEC.elements)) {
      if (el.aria.implicitRole && !isKnownRole(el.aria.implicitRole)) unknownElementRoles.add(el.aria.implicitRole);
      if (el.aria.permittedRoles !== 'any')
        for (const n of el.aria.permittedRoles) if (!isKnownRole(n)) unknownElementRoles.add(n);
    }
    expect(unknownRoles).toEqual([]);
    expect([...unknownProps]).toEqual([]);
    expect([...unknownElementRoles]).toEqual([]);
  });
});
