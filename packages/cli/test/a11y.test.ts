import { describe, it, expect } from 'vitest';
import { collectA11y } from '../src/providers/source/a11y.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';
import { defineConfig } from '@svelte-vitals/core';

const config = defineConfig({});

describe('collectA11y', () => {
  it('maps a Svelte a11y warning to an a11y finding (code as id, line, docsUrl)', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<h1>Home</h1>\n<img src="/a.png" />`
    });
    const results = await collectA11y(rt, '', config);
    const finding = results.find((r) => r.id === 'a11y_missing_attribute');
    expect(finding).toBeDefined();
    expect(finding!.category).toBe('a11y');
    expect(finding!.severity).toBe('warning');
    expect(finding!.route).toBe('/');
    expect(finding!.location).toBe('src/routes/+page.svelte');
    expect(finding!.line).toBe(2);
    expect(finding!.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(finding!.docsUrl).toBe('https://svelte.dev/e/a11y_missing_attribute');
    // message is the first line only (no trailing docs URL line)
    expect(finding!.message).not.toContain('https://');
  });

  it('emits one passing seed for a route with no a11y warnings', async () => {
    const rt = createMemoryRuntime({ 'src/routes/+page.svelte': `<h1>Home</h1>` });
    const results = await collectA11y(rt, '', config);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('a11y');
    expect(results[0]!.category).toBe('a11y');
    expect(results[0]!.detection).toEqual({ presence: 'own', value: 'static' });
    expect(results[0]!.route).toBe('/');
  });

  it('surfaces a layout a11y warning on the child route', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<img src="/logo.png" />\n<slot />`,
      'src/routes/about/+page.svelte': `<h1>About</h1>`
    });
    const results = await collectA11y(rt, '', config);
    const about = results.filter((r) => r.route === '/about' && r.id === 'a11y_missing_attribute');
    expect(about).toHaveLength(1);
    expect(about[0]!.location).toBe('src/routes/+layout.svelte');
  });

  it('skips a code disabled via config.rules', async () => {
    const rt = createMemoryRuntime({ 'src/routes/+page.svelte': `<img src="/a.png" />` });
    const off = defineConfig({ rules: { a11y_missing_attribute: 'off' } });
    const results = await collectA11y(rt, '', off);
    expect(results.some((r) => r.id === 'a11y_missing_attribute')).toBe(false);
    // with its only warning ignored, the route seeds as passing
    expect(results).toEqual([expect.objectContaining({ id: 'a11y', route: '/' })]);
  });

  it('leaves an unparseable route unchecked (no false passing seed)', async () => {
    const rt = createMemoryRuntime({ 'src/routes/+page.svelte': `<div {#bad}></div>` });
    const results = await collectA11y(rt, '', config);
    // no throw, and the unchecked route is excluded from the category rather than
    // seeded as passing — an uncompilable route must not report a false 100.
    expect(results).toEqual([]);
  });

  it('still surfaces findings from compiled files when a sibling file fails to compile', async () => {
    const rt = createMemoryRuntime({
      // layout has a real a11y issue; the page is unparseable
      'src/routes/+layout.svelte': `<img src="/logo.png" />\n<slot />`,
      'src/routes/broken/+page.svelte': `<div {#bad}></div>`
    });
    const results = await collectA11y(rt, '', config);
    const finding = results.find((r) => r.id === 'a11y_missing_attribute');
    expect(finding).toBeDefined();
    expect(finding!.location).toBe('src/routes/+layout.svelte');
    // the broken route is reported via its layout finding, not seeded as passing
    expect(results.some((r) => r.id === 'a11y')).toBe(false);
  });

  it('returns [] when a11y_category sentinel is off (allow-list with no a11y code)', async () => {
    // A route with a missing alt attribute would normally yield a11y_missing_attribute.
    const rt = createMemoryRuntime({ 'src/routes/+page.svelte': `<img src="/a.png" />` });
    const suppressed = defineConfig({ rules: { a11y_category: 'off' } });
    const results = await collectA11y(rt, '', suppressed);
    expect(results).toEqual([]);
  });
});
