import { describe, it, expect } from 'vitest';
import { checkVersionFloor } from '../src/providers/source/project.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

describe('checkVersionFloor', () => {
  it('warns when svelte is below the major-version floor', async () => {
    const rt = createMemoryRuntime({ 'package.json': JSON.stringify({ dependencies: { svelte: '^4.2.0' } }) });
    const warnings = await checkVersionFloor(rt, '');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('svelte "^4.2.0"');
    expect(warnings[0]).toContain('Svelte 5+');
  });

  it('warns when @sveltejs/kit is below the major-version floor', async () => {
    const rt = createMemoryRuntime({
      'package.json': JSON.stringify({ devDependencies: { '@sveltejs/kit': '^1.20.0' } })
    });
    const warnings = await checkVersionFloor(rt, '');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('@sveltejs/kit "^1.20.0"');
    expect(warnings[0]).toContain('SvelteKit 2+');
  });

  it('warns for both when svelte and @sveltejs/kit are both below floor', async () => {
    const rt = createMemoryRuntime({
      'package.json': JSON.stringify({ dependencies: { svelte: '4.0.0', '@sveltejs/kit': '1.0.0' } })
    });
    const warnings = await checkVersionFloor(rt, '');
    expect(warnings).toHaveLength(2);
  });

  it('does not warn when both are at or above the floor', async () => {
    const rt = createMemoryRuntime({
      'package.json': JSON.stringify({ dependencies: { svelte: '^5.56.6', '@sveltejs/kit': '^2.20.0' } })
    });
    expect(await checkVersionFloor(rt, '')).toEqual([]);
  });

  it('does not warn when svelte/@sveltejs/kit are absent from package.json', async () => {
    const rt = createMemoryRuntime({ 'package.json': JSON.stringify({ dependencies: {} }) });
    expect(await checkVersionFloor(rt, '')).toEqual([]);
  });

  it('does not warn (never guesses) on an unparsable range', async () => {
    const rt = createMemoryRuntime({
      'package.json': JSON.stringify({ dependencies: { svelte: 'workspace:*', '@sveltejs/kit': 'latest' } })
    });
    expect(await checkVersionFloor(rt, '')).toEqual([]);
  });

  it('checks devDependencies when the package is not in dependencies', async () => {
    const rt = createMemoryRuntime({ 'package.json': JSON.stringify({ devDependencies: { svelte: '^3.0.0' } }) });
    const warnings = await checkVersionFloor(rt, '');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('svelte "^3.0.0"');
  });

  it('returns no warnings when package.json is absent', async () => {
    expect(await checkVersionFloor(createMemoryRuntime({}), '')).toEqual([]);
  });

  it('returns no warnings when package.json is malformed', async () => {
    const rt = createMemoryRuntime({ 'package.json': '{not json' });
    expect(await checkVersionFloor(rt, '')).toEqual([]);
  });
});
