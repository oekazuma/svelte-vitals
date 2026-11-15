import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { run, type RunOptions } from '../src/index.js';
import { runCli } from '../src/cli.js';
import { workspaceLocationMapper } from '../src/github-actions.js';
import { captureIO } from './helpers/capture-io.js';

const here = dirname(fileURLToPath(import.meta.url));
// Exits 1 and has file= findings.
const fixtureDir = join(here, 'fixtures', 'basic-project');
// Exits 0 with config warnings and file= findings.
const warningsFixtureDir = join(here, 'fixtures', 'config-file-warnings');
const monorepoFixture = join(here, 'fixtures', 'monorepo-project');
const SUMMARY = '/summary.md';
const RETIRED_LINE =
  'svelte-vitals: oekazuma/svelte-vitals-action is retired. Run `npx svelte-vitals@latest ci install --force` to switch this workflow to the CLI.';

async function runCaptured(opts: RunOptions & { env: NodeJS.ProcessEnv }) {
  const out: string[] = [];
  const err: string[] = [];
  const appendFile = vi.fn();
  const code = await run({
    appendFile,
    ...opts,
    log: (line) => out.push(line),
    errorLog: (line) => err.push(line)
  });
  return { code, out: out.join('\n'), err, appendFile };
}

function fileValues(stdout: string): string[] {
  return [...stdout.matchAll(/^::\w+ file=([^,]*)/gm)].map((m) => m[1]!);
}

describe('github reporter under GitHub Actions', () => {
  it('appends the md report to GITHUB_STEP_SUMMARY', async () => {
    const md = await runCaptured({ cwd: fixtureDir, reporter: 'md', env: {} });
    const { appendFile } = await runCaptured({
      cwd: fixtureDir,
      reporter: 'github',
      env: { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: SUMMARY }
    });
    expect(appendFile).toHaveBeenCalledTimes(1);
    expect(md.out).toMatch(/^<!-- svelte-vitals v/);
    expect(appendFile).toHaveBeenCalledWith(SUMMARY, md.out + '\n');
  });

  it('prefixes file= with the project path inside the workspace', async () => {
    const { out } = await runCaptured({
      cwd: fixtureDir,
      reporter: 'github',
      env: { GITHUB_ACTIONS: 'true', GITHUB_WORKSPACE: dirname(fixtureDir) }
    });
    const files = fileValues(out);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/^basic-project\//);
  });

  it('prefixes from the auto-picked app', async () => {
    const { out } = await runCaptured({
      cwd: monorepoFixture,
      reporter: 'github',
      env: { GITHUB_ACTIONS: 'true', GITHUB_WORKSPACE: monorepoFixture },
      stdinIsTTY: true,
      stdoutIsTTY: true,
      selectApp: async () => 'apps/web'
    });
    const files = fileValues(out);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/^apps\/web\//);
  });

  it('emits analysis warnings as ::warning', async () => {
    const { out, err } = await runCaptured({
      cwd: warningsFixtureDir,
      reporter: 'github',
      env: { GITHUB_ACTIONS: 'true' }
    });
    const warnings = out.split('\n').filter((line) => line.startsWith('::warning::'));
    expect(warnings).toContainEqual(expect.stringMatching(/^::warning::svelte-vitals: .*unknown config key/));
    expect(err).toContainEqual(expect.stringMatching(/^svelte-vitals: .*unknown config key/));
  });

  it('strips control characters from the ::warning lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sv-github-warning-'));
    try {
      cpSync(warningsFixtureDir, dir, { recursive: true });
      writeFileSync(join(dir, 'svelte-vitals.config.js'), "export default { '\\u001b[31mevil': true };\n");
      const { out } = await runCaptured({ cwd: dir, reporter: 'github', env: { GITHUB_ACTIONS: 'true' } });
      expect(out).toContain('::warning::svelte-vitals: ');
      expect(out).toContain("unknown config key 'evil' ignored.");
      expect(out).not.toContain('\u001b');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('summary write failure keeps the exit code', async () => {
    const env = { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: SUMMARY };
    const ok = await runCaptured({ cwd: fixtureDir, reporter: 'github', env });
    const failed = await runCaptured({
      cwd: fixtureDir,
      reporter: 'github',
      env,
      appendFile: () => {
        throw new Error('EACCES: permission denied');
      }
    });
    expect(ok.code).toBe(1);
    expect(failed.code).toBe(ok.code);
    expect(failed.out).toBe(ok.out);
    expect(failed.err).toContain('svelte-vitals: could not write the job summary: EACCES: permission denied');
  });

  it('does nothing extra outside GitHub Actions', async () => {
    const plain = await runCaptured({ cwd: warningsFixtureDir, reporter: 'github', env: {} });
    const { out, appendFile } = await runCaptured({
      cwd: warningsFixtureDir,
      reporter: 'github',
      env: { GITHUB_WORKSPACE: dirname(warningsFixtureDir), GITHUB_STEP_SUMMARY: SUMMARY }
    });
    expect(fileValues(out).length).toBeGreaterThan(0);
    expect(out).toBe(plain.out);
    expect(appendFile).not.toHaveBeenCalled();
  });

  it('keeps the old output under the retired action', async () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_WORKSPACE: dirname(warningsFixtureDir),
      GITHUB_STEP_SUMMARY: SUMMARY,
      GITHUB_ACTION_REPOSITORY: 'oekazuma/svelte-vitals-action'
    };
    const plain = await runCaptured({ cwd: warningsFixtureDir, reporter: 'github', env: {} });
    const github = await runCaptured({ cwd: warningsFixtureDir, reporter: 'github', env });
    expect(github.out).toBe(plain.out);
    expect(github.appendFile).not.toHaveBeenCalled();
    expect(github.err.filter((line) => line === RETIRED_LINE)).toHaveLength(1);
    expect(plain.err).not.toContain(RETIRED_LINE);

    const md = await runCaptured({ cwd: warningsFixtureDir, reporter: 'md', env });
    expect(md.err.filter((line) => line === RETIRED_LINE)).toHaveLength(1);
  });
});

describe('runCli', () => {
  it('analyzes under the env it is given, not process.env', async () => {
    const io = captureIO();
    await runCli([fixtureDir], io, { GITHUB_ACTIONS: 'true' });
    expect(io.err).toContain('github reporter auto-selected');
  });
});

describe('workspaceLocationMapper', () => {
  it('resolves a sibling package path against the workspace', () => {
    const fromApp = workspaceLocationMapper({ GITHUB_WORKSPACE: '/ws' }, '/ws/apps/web')!;
    expect(fromApp('../ui/B.svelte')).toBe('apps/ui/B.svelte');
    const fromWeb = workspaceLocationMapper({ GITHUB_WORKSPACE: '/ws' }, '/ws/web')!;
    expect(fromWeb('../../x')).toBe('../../x');
    expect(fromWeb('/abs/x.svelte')).toBe('/abs/x.svelte');
  });

  it('maps nothing without a workspace, outside it, or at its root', () => {
    expect(workspaceLocationMapper({}, '/ws/web')).toBeUndefined();
    expect(workspaceLocationMapper({ GITHUB_WORKSPACE: '' }, '/ws/web')).toBeUndefined();
    expect(workspaceLocationMapper({ GITHUB_WORKSPACE: '/ws' }, '/other/web')).toBeUndefined();
    expect(workspaceLocationMapper({ GITHUB_WORKSPACE: '/ws' }, '/ws')).toBeUndefined();
  });
});
