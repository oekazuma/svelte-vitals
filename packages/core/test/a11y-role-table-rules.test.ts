import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';
import { a11yDisallowedAriaProps, a11yDeprecatedAria } from '../src/internal.js';
import { COMPILER_ACCEPTS } from '../src/rules/a11y/disallowed-aria-props.js';
import { roleCandidates } from '../src/rules/a11y/role-candidates.js';
import { HTML_SPEC } from '../src/html-spec/index.js';
import { defineConfig, defaultProject, type Result } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const ctx = (src: string): RuleContext => ({
  heads: [],
  project: defaultProject,
  config,
  components: [{ ...parseComponentFacts(src, 'src/lib/C.svelte'), file: 'src/lib/C.svelte' }]
});
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none').map((r) => r.message);
const disallowed = async (src: string) => fails(await a11yDisallowedAriaProps.check(ctx(src)));
const deprecated = async (src: string) => fails(await a11yDeprecatedAria.check(ctx(src)));
const el = (src: string) => parseComponentFacts(src, 'C.svelte').ariaElements![0]!;

describe('roleCandidates', () => {
  it('resolves an explicit role to its first concrete token', () => {
    expect(roleCandidates(el('<div role="switch checkbox" aria-checked="true">x</div>'))).toEqual({
      explicit: true,
      roles: ['switch'],
      namingProhibited: false
    });
  });

  it('is undefined for an expression role, and for a spread with no literal role', () => {
    expect(roleCandidates(el('<div role={r} aria-label="x">x</div>'))).toBeUndefined();
    expect(roleCandidates(el('<div {...p} aria-label="x">x</div>'))).toBeUndefined();
  });

  it('keeps judging the explicit role when a spread is also present', () => {
    expect(roleCandidates(el('<div role="checkbox" {...p} aria-checked="true">x</div>'))?.explicit).toBe(true);
  });

  it('collects the default and every condition outcome as implicit candidates', () => {
    expect(roleCandidates(el('<a aria-label="x">x</a>'))).toEqual({
      explicit: false,
      roles: ['link', 'generic'],
      namingProhibited: false
    });
    expect(roleCandidates(el('<div aria-label="x">x</div>'))).toEqual({
      explicit: false,
      roles: ['generic'],
      namingProhibited: true
    });
    // "No corresponding role" is `false`, not generic.
    expect(roleCandidates(el('<canvas aria-label="x"></canvas>'))?.roles).toEqual([false]);
    expect(roleCandidates(el('<label aria-label="x">x</label>'))).toEqual({
      explicit: false,
      roles: [false],
      namingProhibited: true
    });
  });

  it("replaces hgroup and address facts with html-aria's reading", () => {
    expect(roleCandidates(el('<hgroup aria-label="x">x</hgroup>'))).toEqual({
      explicit: false,
      roles: ['group'],
      namingProhibited: false
    });
    expect(roleCandidates(el('<address aria-label="x">x</address>'))).toEqual({
      explicit: false,
      roles: ['group'],
      namingProhibited: false
    });
  });
});

describe('a11y/disallowed-aria-props', () => {
  it('reports a name on an element whose role does not take one — the corpus case', async () => {
    expect(await disallowed('<div aria-label="Breadcrumb">x</div>')).toEqual([
      '`aria-label` is prohibited on <div> — its role does not take a name'
    ]);
    expect(await disallowed('<label for="x" aria-label="close sidebar">x</label>')).toHaveLength(1);
  });

  it('reports an attribute the role does not own, with the role named', async () => {
    expect(await disallowed('<span aria-level="2">x</span>')).toEqual([
      '`aria-level` is not supported by role `generic`'
    ]);
    expect(await disallowed('<div role="button" aria-checked="true">x</div>')).toEqual([
      '`aria-checked` is not supported by role `button`'
    ]);
  });

  it('reports a role-row prohibition that is not a naming attribute, and not one the role owns', async () => {
    expect(await disallowed('<div aria-roledescription="carousel">x</div>')).toEqual([
      '`aria-roledescription` is prohibited on role `generic`'
    ]);
    expect(await disallowed('<p aria-brailleroledescription="x">x</p>')).toEqual([]);
  });

  it('stays silent where a conditional implicit role could own the attribute', async () => {
    expect(await disallowed('<a aria-label="x">x</a>')).toEqual([]);
    expect(await disallowed('<img aria-label="x" alt="" />')).toEqual([]);
    expect(await disallowed('<input aria-checked="true" />')).toEqual([]);
    expect(await disallowed('<canvas aria-label="x"></canvas>')).toEqual([]);
  });

  it('honours the two exemption lists', async () => {
    expect(await disallowed('<li aria-level="2">x</li>')).toEqual([]);
    expect(await disallowed('<div role="listbox" aria-expanded="true">x</div>')).toEqual([]);
    expect(await disallowed('<address aria-label="x">x</address>')).toEqual([]);
    expect(await disallowed('<hgroup aria-label="x">x</hgroup>')).toEqual([]);
  });

  it('gives no judgment for a DPUB role, an expression role, or a spread with no literal role', async () => {
    expect(await disallowed('<div role="doc-toc" aria-checked="true">x</div>')).toEqual([]);
    expect(await disallowed('<div role={r} aria-checked="true">x</div>')).toEqual([]);
    expect(await disallowed('<div {...p} aria-checked="true">x</div>')).toEqual([]);
  });

  it('skips unknown attributes — one typo yields one finding, from unknown-aria-attribute', async () => {
    expect(await disallowed('<div role="button" aria-lable="x">x</div>')).toEqual([]);
  });

  it('pins the compiler-accepts list to exactly the ten pairs the tables disagree on', () => {
    expect([...COMPILER_ACCEPTS].sort()).toEqual([
      'graphics-document aria-expanded',
      'graphics-object aria-expanded',
      'graphics-symbol aria-expanded',
      'listbox aria-expanded',
      'listitem aria-level',
      'menuitemcheckbox aria-readonly',
      'menuitemcheckbox aria-required',
      'menuitemradio aria-readonly',
      'menuitemradio aria-required',
      'tablist aria-level'
    ]);
    // Every pinned pair is genuinely unowned in the vendored table — an exemption for an owned pair
    // would be dead, and a stale one after a data bump shows up here.
    for (const pair of COMPILER_ACCEPTS) {
      const [role, prop] = pair.split(' ') as [string, string];
      expect(
        HTML_SPEC.aria.roles[role]!.ownedProperties.some((p) => p.name === prop),
        pair
      ).toBe(false);
    }
  });
});

describe('a11y/deprecated-aria', () => {
  it('reports the deprecated role', async () => {
    expect(await deprecated('<ul role="directory"><li>x</li></ul>')).toEqual(['role="directory" is deprecated']);
  });

  it('reports the two globally deprecated attributes on any element', async () => {
    expect(await deprecated('<canvas aria-grabbed="true"></canvas>')).toEqual(['`aria-grabbed` is deprecated']);
  });

  it('reports an attribute deprecated on the resolved role, explicit or implicit', async () => {
    expect(await deprecated('<div role="checkbox" aria-checked="false" aria-haspopup="true">x</div>')).toEqual([
      '`aria-haspopup` is deprecated on role `checkbox`'
    ]);
    expect(await deprecated('<div role="menuitem" aria-haspopup="true">x</div>')).toEqual([]);
    expect(await deprecated('<div aria-disabled="true">x</div>')).toEqual([
      '`aria-disabled` is deprecated on role `generic`'
    ]);
  });

  it('follows the hgroup fact replacement without over-silencing it', async () => {
    expect(await deprecated('<hgroup aria-disabled="true">x</hgroup>')).toEqual([]);
    expect(await deprecated('<hgroup aria-haspopup="true">x</hgroup>')).toEqual([
      '`aria-haspopup` is deprecated on role `group`'
    ]);
    expect(await disallowed('<hgroup aria-level="2">x</hgroup>')).toEqual([
      '`aria-level` is not supported by role `group`'
    ]);
  });
});
