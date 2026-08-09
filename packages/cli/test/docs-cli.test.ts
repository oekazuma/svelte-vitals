import { describe, it, expect } from 'vitest';
import { runDocsCli } from '../src/docs/cli.js';
import { captureIO } from './helpers/capture-io.js';
import { EMBEDDED_DOCS } from '../src/docs/generated.js';

function docs(args: string[]): { code: number; out: string; err: string } {
  const io = captureIO();
  const code = runDocsCli(args, io);
  return { code, out: io.out, err: io.err };
}

describe('svelte-vitals docs list', () => {
  it('lists every embedded topic with its description', () => {
    const { code, out } = docs(['list']);
    expect(code).toBe(0);
    for (const d of EMBEDDED_DOCS) {
      expect(out).toContain(d.name);
      expect(out).toContain(d.description);
    }
  });

  it('points at `explain --list` for rule-level detail', () => {
    expect(docs(['list']).out).toContain('svelte-vitals explain --list');
  });

  it('refuses a stray argument', () => {
    const { code, out, err } = docs(['list', 'config']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('takes no arguments');
  });

  it('--json emits name/title/description per topic', () => {
    const { code, out } = docs(['list', '--json']);
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
  it('prints the topic body without its frontmatter', () => {
    const { code, out } = docs(['show', 'config']);
    expect(code).toBe(0);
    expect(out).toContain('# The config file');
    expect(out).not.toContain('---\ntitle:');
  });

  it('exits 2 and lists the topics for an unknown name', () => {
    const { code, out, err } = docs(['show', 'nope']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown docs topic 'nope'");
    expect(err).toContain('known topics:');
    expect(err).toContain('config');
  });

  it('refuses a second topic', () => {
    const { code, out, err } = docs(['show', 'output', 'config']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('one topic at a time');
  });

  it('redirects a rule id to `explain` instead of the generic unknown-topic error', () => {
    const { code, out, err } = docs(['show', 'architecture/component-size']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("'architecture/component-size' is a rule, not a docs topic");
    expect(err).toContain('explain architecture/component-size');
  });

  it('redirects a rule id given with the web docs `rules/` prefix', () => {
    const { code, out, err } = docs(['show', 'rules/architecture/component-size']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("'architecture/component-size' is a rule, not a docs topic");
    expect(err).toContain('explain architecture/component-size');
  });

  it('exits 2 when no topic name is given', () => {
    const { code, err } = docs(['show']);
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
  it('a bare `docs` prints usage on stderr and exits 2', () => {
    const { code, out, err } = docs([]);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('svelte-vitals docs list');
    expect(err).toContain('svelte-vitals docs show <name>');
  });

  it('--help exits 0', () => {
    const { code, out } = docs(['--help']);
    expect(code).toBe(0);
    expect(out).toContain('svelte-vitals docs');
  });

  it('an unknown subcommand exits 2 and names the valid ones', () => {
    const { code, out, err } = docs(['read', 'config']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown docs subcommand 'read'");
    expect(err).toContain('list|show');
  });

  it('documents the escape hatch for a ./docs directory', () => {
    expect(docs(['--help']).out).toContain('svelte-vitals ./docs');
  });

  it('says the topics match the running version', () => {
    expect(docs(['--help']).out).toContain('always match the version you are running');
  });
});
