import { describe, it, expect } from 'vitest';
import { securityRawHtml, securityJavascriptUrl } from '../src/internal.js';
import { defineConfig, defaultProject } from '../src/types.js';
import { emptyComponentFacts } from '../src/component.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { heads: [], project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const ctx = (components: ComponentFacts[]): RuleContext => ({ components, ...base });
const comp = (over: Partial<ComponentFacts>): ComponentFacts => ({
  ...emptyComponentFacts('src/lib/C.svelte'),
  loc: 10,
  ...over
});

describe('security/raw-html raw HTML render', () => {
  it('flags a component using {@html}', async () => {
    const rs = await securityRawHtml.check(ctx([comp({ htmlTags: [{ line: 4 }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('security');
    expect(rs[0]!.line).toBe(4);
  });
  it('emits nothing for a component without {@html}', async () => {
    expect(await securityRawHtml.check(ctx([comp({})]))).toHaveLength(0);
  });
  it('emits nothing when the component channel is unset (rendered mode)', async () => {
    expect(await securityRawHtml.check(base as RuleContext)).toHaveLength(0);
  });
});

describe('security/javascript-url javascript: URL', () => {
  it('flags a javascript: URL', async () => {
    const rs = await securityJavascriptUrl.check(ctx([comp({ javascriptUrls: [{ line: 7 }] })]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('security');
  });
  it('emits nothing without a javascript: URL', async () => {
    expect(await securityJavascriptUrl.check(ctx([comp({})]))).toHaveLength(0);
  });
});
