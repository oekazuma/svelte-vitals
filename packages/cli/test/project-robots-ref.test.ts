import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProjectFacts } from '../src/providers/source/project.js';
import { createNodeRuntime } from '../src/runtime/node.js';

let cwd: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'sv-robots-'));
  await mkdir(join(cwd, 'static'), { recursive: true });
});
afterEach(async () => rm(cwd, { recursive: true, force: true }));

describe('collectProjectFacts: robotsReferencesSitemap', () => {
  it('true when static/robots.txt has a Sitemap: line', async () => {
    await writeFile(join(cwd, 'static/robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://e.com/sitemap.xml\n');
    expect((await collectProjectFacts(createNodeRuntime(), cwd)).robotsReferencesSitemap).toBe(true);
  });
  it('false when static/robots.txt lacks a Sitemap: line', async () => {
    await writeFile(join(cwd, 'static/robots.txt'), 'User-agent: *\nAllow: /\n');
    expect((await collectProjectFacts(createNodeRuntime(), cwd)).robotsReferencesSitemap).toBe(false);
  });
  it('undefined when there is no static robots.txt', async () => {
    expect((await collectProjectFacts(createNodeRuntime(), cwd)).robotsReferencesSitemap).toBeUndefined();
  });
});
