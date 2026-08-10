import { describe, it, expect } from 'vitest';
import { runDocsCliGunshi } from '../src/gunshi/docs.js';
import { captureIO } from './helpers/capture-io.js';
import { EMBEDDED_DOCS } from '../src/docs/generated.js';

async function docs(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const io = captureIO();
  const code = await runDocsCliGunshi(args, io);
  return { code, out: io.out, err: io.err };
}

describe('svelte-vitals docs list', () => {
  it('lists every embedded topic with its description', async () => {
    const { code, out } = await docs(['list']);
    expect(code).toBe(0);
    for (const d of EMBEDDED_DOCS) {
      expect(out).toContain(d.name);
      expect(out).toContain(d.description);
    }
  });

  it('points at `explain --list` for rule-level detail', async () => {
    expect((await docs(['list'])).out).toContain('svelte-vitals explain --list');
  });

  it('refuses a stray argument', async () => {
    const { code, out, err } = await docs(['list', 'config']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('takes no arguments');
  });

  it('--json emits name/title/description per topic', async () => {
    const { code, out } = await docs(['list', '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(out) as { name: string; title: string; description: string }[];
    expect(parsed.map((d) => d.name)).toEqual(EMBEDDED_DOCS.map((d) => d.name));
    for (const d of parsed) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });
});

describe('svelte-vitals docs show', () => {
  it('prints the topic body without its frontmatter', async () => {
    const { code, out } = await docs(['show', 'config']);
    expect(code).toBe(0);
    expect(out).toContain('# The config file');
    expect(out).not.toContain('---\ntitle:');
  });

  it('exits 2 and lists the topics for an unknown name', async () => {
    const { code, out, err } = await docs(['show', 'nope']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown docs topic 'nope'");
    expect(err).toContain('known topics:');
    expect(err).toContain('config');
  });

  it('refuses a second topic', async () => {
    const { code, out, err } = await docs(['show', 'output', 'config']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('one topic at a time');
  });

  it('redirects a rule id to `explain` instead of the generic unknown-topic error', async () => {
    const { code, out, err } = await docs(['show', 'architecture/component-size']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("'architecture/component-size' is a rule, not a docs topic");
    expect(err).toContain('explain architecture/component-size');
  });

  it('redirects a rule id given with the web docs `rules/` prefix', async () => {
    const { code, out, err } = await docs(['show', 'rules/architecture/component-size']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("'architecture/component-size' is a rule, not a docs topic");
    expect(err).toContain('explain architecture/component-size');
  });

  it('exits 2 when no topic name is given', async () => {
    const { code, err } = await docs(['show']);
    expect(code).toBe(2);
    expect(err).toContain('docs show needs a topic name');
  });
});

describe('discovery pointers', () => {
  it('the not-a-project error names the topic explaining app resolution', async () => {
    const { detectProject } = await import('../src/providers/source/project.js');
    const { createMemoryRuntime } = await import('./helpers/memory-runtime.js');
    await expect(detectProject(createMemoryRuntime({}), '/proj')).rejects.toThrow(/docs show monorepo/);
  });
});

describe('svelte-vitals docs — dispatch', () => {
  it('a bare `docs` prints usage on stderr and exits 2', async () => {
    const { code, out, err } = await docs([]);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('svelte-vitals docs list');
    expect(err).toContain('svelte-vitals docs show <name>');
  });

  it('--help exits 0', async () => {
    const { code, out } = await docs(['--help']);
    expect(code).toBe(0);
    expect(out).toContain('svelte-vitals docs');
  });

  it('an unknown subcommand exits 2 and names the valid ones', async () => {
    const { code, out, err } = await docs(['read', 'config']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown docs subcommand 'read'");
    expect(err).toContain('list|show');
  });

  it('documents the escape hatch for a ./docs directory', async () => {
    expect((await docs(['--help'])).out).toContain('svelte-vitals ./docs');
  });

  it('says the topics match the running version', async () => {
    expect((await docs(['--help'])).out).toContain('always match the version you are running');
  });
});
