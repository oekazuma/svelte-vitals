import { describe, it, expect } from 'vitest';
import { runInstall, type InstallIO, type InstallPrompts } from '../../src/install/index.js';

function fakeIO(
  over: {
    files?: Record<string, string>;
    isTTY?: boolean;
    failWritePath?: string;
    throwOnRead?: string;
    runCommand?: (command: string, args: string[], cwd: string) => number;
    discoverApps?: (cwd: string) => Promise<string[]>;
  } = {}
) {
  const files = over.files ?? {};
  const writes: Record<string, string> = {};
  const out: string[] = [];
  const err: string[] = [];
  const io: InstallIO = {
    readFile: (p) => {
      if (over.throwOnRead && p === over.throwOnRead) {
        throw new Error(`EACCES: permission denied, open '${p}'`);
      }
      return files[p];
    },
    writeFile: (p, c) => {
      if (over.failWritePath && p === over.failWritePath) {
        throw new Error(`EACCES: permission denied, open '${p}'`);
      }
      writes[p] = c;
    },
    cwd: '/proj',
    isTTY: over.isTTY ?? false,
    log: (l) => out.push(l),
    errorLog: (l) => err.push(l),
    // Tests use a virtual filesystem, so the real fs-backed discoverApps would
    // scan the actual repo — default to "no apps found" unless a test injects one.
    discoverApps: over.discoverApps ?? (async () => []),
    ...(over.runCommand ? { runCommand: over.runCommand } : {})
  };
  return { io, writes, out, err };
}

const noPrompts: InstallPrompts = {
  selectClients: async () => null,
  selectApp: async () => null,
  confirm: async () => true
};

const MDC_PATH = '/proj/.cursor/rules/svelte-vitals.mdc';

describe('runInstall', () => {
  it('non-TTY without --client exits 2 with guidance', async () => {
    const { io, err } = fakeIO();
    expect(await runInstall({}, io, noPrompts)).toBe(2);
    expect(err.join('\n')).toContain('--client');
  });
  it('an unknown-only --client selection exits 2', async () => {
    const { io, err } = fakeIO();
    // resolveInstallArgs filters unknown ids before this point, but runInstall is also
    // called directly, so it has to refuse an empty effective selection itself.
    expect(await runInstall({ client: ['bogus' as never] }, io, noPrompts)).toBe(2);
    expect(err.join('\n')).toContain('no valid targets selected');
  });
  it('dry-run writes nothing', async () => {
    const { io, writes, out } = fakeIO();
    expect(await runInstall({ client: ['cursor-rules'], dryRun: true }, io, noPrompts)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run');
  });
  it('TTY confirm=false writes nothing', async () => {
    const { io, writes } = fakeIO({ isTTY: true });
    const prompts: InstallPrompts = { ...noPrompts, confirm: async () => false };
    expect(await runInstall({ client: ['cursor-rules'] }, io, prompts)).toBe(0);
    expect(writes).toEqual({});
  });
  it('TTY client-picker cancel exits 0 without writing', async () => {
    const { io, writes } = fakeIO({ isTTY: true });
    const prompts: InstallPrompts = { ...noPrompts, selectClients: async () => null };
    expect(await runInstall({}, io, prompts)).toBe(0);
    expect(writes).toEqual({});
  });
  it('TTY detection tolerates a throwing readFile (e.g. EACCES) without crashing', async () => {
    const { io, writes } = fakeIO({ isTTY: true, throwOnRead: MDC_PATH });
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectClients: async () => ['ci-workflow'],
      confirm: async () => true
    };
    expect(await runInstall({}, io, prompts)).toBe(0);
    expect(Object.keys(writes)).toEqual(['/proj/.github/workflows/svelte-vitals.yml']);
  });
  it('a per-file write failure names the failing path, keeps the remaining writes, and does not abort the run', async () => {
    const { io, writes, err } = fakeIO({ failWritePath: MDC_PATH });
    const code = await runInstall({ client: ['cursor-rules', 'ci-workflow'], yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes[MDC_PATH]).toBeUndefined();
    expect(writes['/proj/.github/workflows/svelte-vitals.yml']).toBeDefined();
    expect(err.join('\n')).toContain(MDC_PATH);
  });
});

describe('runInstall — Vite targets', () => {
  it('vite-plugin: no vite.config found → manual, no write, snippet shown in the plan', async () => {
    const { io, writes, out } = fakeIO();
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('manual');
    expect(out.join('\n')).toContain("import { svelteVitals } from '@svelte-vitals/vite';");
  });

  it('vite-plugin: recognized vite.config.ts → written, and @svelte-vitals/vite is installed', async () => {
    const viteConfig = `
import { sveltekit } from '@sveltejs/kit/vite';
export default { plugins: [sveltekit()] };
`;
    const runCalls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const { io, writes } = fakeIO({
      files: { '/proj/vite.config.ts': viteConfig, '/proj/package.json': '{}' },
      runCommand: (command, args, cwd) => {
        runCalls.push({ command, args, cwd });
        return 0;
      }
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes['/proj/vite.config.ts']).toContain('svelteVitals()');
    expect(runCalls).toEqual([{ command: 'npm', args: ['install', '-D', '@svelte-vitals/vite'], cwd: '/proj' }]);
  });

  it('vite-plugin: logs the actually-resolved @svelte-vitals/vite version after a successful install', async () => {
    // The package manager fake doesn't really write node_modules, so seed the file it would have
    // produced — this is what lets the version-drift concern (an install silently resolving to an
    // older release, e.g. via pnpm's minimumReleaseAge) be visible in the install log.
    const { io, out } = fakeIO({
      files: {
        '/proj/vite.config.ts': `export default { plugins: [] };`,
        '/proj/package.json': '{}',
        '/proj/node_modules/@svelte-vitals/vite/package.json': JSON.stringify({ version: '0.11.1' })
      },
      runCommand: () => 0
    });
    await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(out.join('\n')).toContain('installed @svelte-vitals/vite@0.11.1');
  });

  it('vite-plugin: falls back to a plain message when the installed version cannot be read', async () => {
    const { io, out } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      runCommand: () => 0
    });
    await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(out.join('\n')).toContain('could not read the installed version');
  });

  it('vite-plugin: package already installed → no install command run', async () => {
    const viteConfig = `export default { plugins: [] };`;
    const runCalls: unknown[] = [];
    const { io } = fakeIO({
      files: {
        '/proj/vite.config.ts': viteConfig,
        '/proj/package.json': JSON.stringify({ devDependencies: { '@svelte-vitals/vite': '^1.0.0' } })
      },
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(runCalls).toEqual([]);
  });

  it('vite-plugin: already registered → exists, no write, no install attempt', async () => {
    const viteConfig = `
import { svelteVitals } from '@svelte-vitals/vite';
export default { plugins: [svelteVitals()] };
`;
    const runCalls: unknown[] = [];
    const { io, writes, out } = fakeIO({
      files: { '/proj/vite.config.ts': viteConfig },
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(writes).toEqual({});
    expect(runCalls).toEqual([]);
    expect(out.join('\n')).toContain('already configured');
    // --force never applies to Vite targets, so the message must not suggest it.
    expect(out.join('\n')).not.toContain('--force');
  });

  it('vite-hooks: no hooks.server.ts → created', async () => {
    const { io, writes } = fakeIO({ files: { '/proj/package.json': '{}' }, runCommand: () => 0 });
    await runInstall({ client: ['vite-hooks'], yes: true }, io, noPrompts);
    expect(writes['/proj/src/hooks.server.ts']).toContain('svelteVitalsHandle');
  });

  it('dry-run does not write vite targets or run the package manager', async () => {
    const runCalls: unknown[] = [];
    const { io, writes } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };` },
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    await runInstall({ client: ['vite-plugin'], dryRun: true }, io, noPrompts);
    expect(writes).toEqual({});
    expect(runCalls).toEqual([]);
  });

  it('a read failure (e.g. EACCES) while planning a Vite target is reported and exits 2', async () => {
    // Every other target loop turns a non-ENOENT readFile throw into a friendly exit 2;
    // the Vite loop used to let it reject out of runInstall as an unhandled rejection.
    const { io, writes, err } = fakeIO({ throwOnRead: '/proj/vite.config.ts' });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain('could not check existing Vite target vite-plugin');
    expect(err.join('\n')).toContain('EACCES');
  });

  it('a plan can mix an agent skill and a Vite target in one run', async () => {
    const { io, writes } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      runCommand: () => 0
    });
    await runInstall({ client: ['cursor-rules', 'vite-plugin'], yes: true }, io, noPrompts);
    expect(Object.keys(writes).sort()).toEqual([MDC_PATH, '/proj/vite.config.ts']);
  });

  it('a failed package-manager install is reported but does not fail the run', async () => {
    const { io, err, out } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      runCommand: () => 1
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(err.join('\n')).toContain('@svelte-vitals/vite');
    expect(out.join('\n')).not.toContain('installed @svelte-vitals/vite@'); // no version log on a failed install
  });

  it('a partial failure (a skill write fails) still runs the package-manager install for a Vite target that already succeeded', async () => {
    const runCalls: unknown[] = [];
    const { io, writes, err } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      failWritePath: MDC_PATH,
      runCommand: (...args) => (runCalls.push(args), 0)
    });
    const code = await runInstall({ client: ['cursor-rules', 'vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes['/proj/vite.config.ts']).toContain('svelteVitals()');
    expect(runCalls.length).toBe(1);
    expect(err.join('\n')).toContain(MDC_PATH);
  });
});

describe('runInstall — agent targets', () => {
  /** Drive the interactive picker just far enough to read back its pre-selected defaults. */
  async function pickerDefaults(files: Record<string, string>): Promise<string[]> {
    const { io } = fakeIO({ isTTY: true, files });
    let seenDefaults: string[] = [];
    await runInstall({}, io, {
      ...noPrompts,
      selectClients: async (_groups, defaults) => {
        seenDefaults = defaults;
        return null;
      }
    });
    return seenDefaults;
  }

  it('pre-selects cursor-rules from a file Cursor itself keeps, before anything is installed', async () => {
    // The signal is "this project uses Cursor", from a file Cursor itself keeps —
    // not "svelte-vitals already wrote its rules file".
    // A first-time Cursor user must still get the box ticked by default.
    for (const signal of ['/proj/.cursor/mcp.json', '/proj/.cursor/environment.json', '/proj/.cursorrules']) {
      expect(await pickerDefaults({ [signal]: 'x' })).toContain('cursor-rules');
    }
  });

  it('pre-selects cursor-rules when its own rules file is already there', async () => {
    expect(await pickerDefaults({ '/proj/.cursor/rules/svelte-vitals.mdc': 'x' })).toContain('cursor-rules');
  });

  it('does not pre-select cursor-rules in a project with no Cursor signal at all', async () => {
    expect(await pickerDefaults({})).not.toContain('cursor-rules');
  });

  it('cursor-rules: not present → created, content has frontmatter and the version', async () => {
    const { io, writes } = fakeIO();
    const code = await runInstall({ client: ['cursor-rules'], yes: true }, io, noPrompts, '9.9.9');
    expect(code).toBe(0);
    const content = writes['/proj/.cursor/rules/svelte-vitals.mdc'];
    expect(content).toContain('globs:');
    expect(content).toContain('svelte-vitals 9.9.9');
  });

  it('a second run without --force reports exists and writes nothing', async () => {
    const first = fakeIO();
    await runInstall({ client: ['cursor-rules'], yes: true }, first.io, noPrompts);
    const { io, writes, out } = fakeIO({ files: { ...first.writes } });
    const code = await runInstall({ client: ['cursor-rules'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already configured');
    expect(out.join('\n')).toContain('--force to overwrite');
  });

  it('--force regenerates an already-existing agent target file', async () => {
    const { io, writes } = fakeIO({ files: { [MDC_PATH]: 'stale content' } });
    const code = await runInstall({ client: ['cursor-rules'], yes: true, force: true }, io, noPrompts, '1.0.0');
    expect(code).toBe(0);
    expect(writes[MDC_PATH]).toContain('svelte-vitals 1.0.0');
  });

  it('dry-run does not write agent target files', async () => {
    const { io, writes, out } = fakeIO();
    const code = await runInstall({ client: ['cursor-rules'], dryRun: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run');
  });

  it('interactive picker options include cursor-rules but not the retired SKILL.md targets', async () => {
    const { io } = fakeIO({ isTTY: true });
    let seenOptions: string[] = [];
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectClients: async (groups) => {
        seenOptions = Object.values(groups)
          .flat()
          .map((o) => o.id);
        return null;
      }
    };
    await runInstall({}, io, prompts);
    expect(seenOptions).toContain('cursor-rules');
    expect(seenOptions).not.toContain('claude-skill');
    expect(seenOptions).not.toContain('claude-skill-improve');
  });

  it('a read failure (e.g. EACCES) while planning an agent target is reported and exits 2', async () => {
    const { io, writes, err } = fakeIO({
      throwOnRead: MDC_PATH
    });
    const code = await runInstall({ client: ['cursor-rules'], yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain('could not check existing agent target cursor-rules');
    expect(err.join('\n')).toContain('EACCES');
  });
});

describe('runInstall — config-file target', () => {
  it('config-file: not present → created, content has every option commented out', async () => {
    const { io, writes } = fakeIO();
    const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    const content = writes['/proj/svelte-vitals.config.js'];
    expect(content).toContain('export default {');
    expect(content).toContain('// failOn:');
  });

  it('a second run without --force reports exists and writes nothing', async () => {
    const first = fakeIO();
    await runInstall({ client: ['config-file'], yes: true }, first.io, noPrompts);
    const existing = first.writes['/proj/svelte-vitals.config.js']!;
    const { io, writes, out } = fakeIO({ files: { '/proj/svelte-vitals.config.js': existing } });
    const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already configured');
    expect(out.join('\n')).toContain('--force to overwrite');
  });

  it('--force regenerates an already-existing config file', async () => {
    const { io, writes } = fakeIO({
      files: { '/proj/svelte-vitals.config.js': 'stale content' }
    });
    const code = await runInstall({ client: ['config-file'], yes: true, force: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes['/proj/svelte-vitals.config.js']).toContain('export default {');
    expect(writes['/proj/svelte-vitals.config.js']).not.toBe('stale content');
  });

  it('dry-run does not write the config file', async () => {
    const { io, writes, out } = fakeIO();
    const code = await runInstall({ client: ['config-file'], dryRun: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run');
  });

  it('a plan can mix an agent skill and the config-file target in one run', async () => {
    const { io, writes } = fakeIO();
    await runInstall({ client: ['cursor-rules', 'config-file'], yes: true }, io, noPrompts);
    expect(Object.keys(writes).sort()).toEqual([MDC_PATH, '/proj/svelte-vitals.config.js']);
  });

  it('interactive picker options include the config-file target', async () => {
    const { io } = fakeIO({ isTTY: true });
    let seenOptions: string[] = [];
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectClients: async (groups) => {
        seenOptions = Object.values(groups)
          .flat()
          .map((o) => o.id);
        return null;
      }
    };
    await runInstall({}, io, prompts);
    expect(seenOptions).toContain('config-file');
  });

  describe('auto-picking the best extension', () => {
    // The .ts template imports defineConfig at runtime, so .ts is only picked when
    // svelte-vitals is a declared dependency — these fixtures declare it.
    const PKG_WITH_DEP = JSON.stringify({ type: 'module', devDependencies: { 'svelte-vitals': '^0.26.0' } });

    it('a TS project with svelte-vitals installed → .ts with defineConfig', async () => {
      const { io, writes } = fakeIO({
        files: { '/proj/tsconfig.json': '{}', '/proj/package.json': PKG_WITH_DEP }
      });
      const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
      expect(code).toBe(0);
      const content = writes['/proj/svelte-vitals.config.ts'];
      expect(content).toBeDefined();
      expect(content).toContain("import { defineConfig } from 'svelte-vitals';");
      expect(content).toContain('export default defineConfig({');
      expect(writes['/proj/svelte-vitals.config.js']).toBeUndefined();
    });

    it('a vite.config.ts alone (no tsconfig.json) is enough to pick .ts', async () => {
      const { io, writes } = fakeIO({
        files: { '/proj/vite.config.ts': 'export default {}', '/proj/package.json': PKG_WITH_DEP }
      });
      await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
      expect(writes['/proj/svelte-vitals.config.ts']).toBeDefined();
    });

    it('an npx-only TS project (svelte-vitals not in package.json) gets .js — the defineConfig import would not resolve at load time', async () => {
      const { io, writes } = fakeIO({
        files: { '/proj/tsconfig.json': '{}', '/proj/package.json': JSON.stringify({ type: 'module' }) }
      });
      await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
      expect(writes['/proj/svelte-vitals.config.js']).toBeDefined();
      expect(writes['/proj/svelte-vitals.config.ts']).toBeUndefined();
      expect(writes['/proj/svelte-vitals.config.js']).not.toContain('defineConfig');
    });

    it('a plain JS project (no tsconfig.json, no vite.config.ts) gets .js', async () => {
      const { io, writes } = fakeIO({ files: { '/proj/package.json': PKG_WITH_DEP } });
      await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
      expect(writes['/proj/svelte-vitals.config.js']).toBeDefined();
    });

    it('a second run detects an existing .ts config (not just .js) and reports exists without creating a duplicate .js', async () => {
      const first = fakeIO({
        files: { '/proj/tsconfig.json': '{}', '/proj/package.json': PKG_WITH_DEP }
      });
      await runInstall({ client: ['config-file'], yes: true }, first.io, noPrompts);
      const existingTs = first.writes['/proj/svelte-vitals.config.ts']!;

      const { io, writes, out } = fakeIO({
        files: {
          '/proj/tsconfig.json': '{}',
          '/proj/package.json': PKG_WITH_DEP,
          '/proj/svelte-vitals.config.ts': existingTs
        }
      });
      const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
      expect(code).toBe(0);
      expect(writes).toEqual({});
      expect(out.join('\n')).toContain('already configured');
    });

    it('--force on an existing .ts config regenerates .ts, not .js, even without a tsconfig.json anymore', async () => {
      const { io, writes } = fakeIO({
        files: { '/proj/svelte-vitals.config.ts': 'stale ts content', '/proj/package.json': PKG_WITH_DEP }
      });
      const code = await runInstall({ client: ['config-file'], yes: true, force: true }, io, noPrompts);
      expect(code).toBe(0);
      expect(writes['/proj/svelte-vitals.config.ts']).toContain('defineConfig');
      expect(writes['/proj/svelte-vitals.config.js']).toBeUndefined();
    });

    it('--force on an existing .ts config without svelte-vitals installed regenerates it dependency-free (plain object)', async () => {
      const { io, writes } = fakeIO({
        files: {
          '/proj/svelte-vitals.config.ts': 'stale ts content',
          '/proj/package.json': JSON.stringify({ type: 'module' })
        }
      });
      const code = await runInstall({ client: ['config-file'], yes: true, force: true }, io, noPrompts);
      expect(code).toBe(0);
      expect(writes['/proj/svelte-vitals.config.ts']).toContain('export default {');
      expect(writes['/proj/svelte-vitals.config.ts']).not.toContain('defineConfig');
    });

    it('--force on an existing .js config in an ESM project regenerates it as ESM (no defineConfig)', async () => {
      const { io, writes } = fakeIO({
        files: {
          '/proj/svelte-vitals.config.js': 'stale js content',
          '/proj/package.json': JSON.stringify({ type: 'module' })
        }
      });
      const code = await runInstall({ client: ['config-file'], yes: true, force: true }, io, noPrompts);
      expect(code).toBe(0);
      expect(writes['/proj/svelte-vitals.config.js']).toContain('export default {');
      expect(writes['/proj/svelte-vitals.config.js']).not.toContain('defineConfig');
    });

    it('a leftover retired .mjs config gets a manual rename hint instead of a duplicate scaffold', async () => {
      const { io, writes, out } = fakeIO({
        files: { '/proj/svelte-vitals.config.mjs': 'export default {};' }
      });
      const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
      expect(code).toBe(0);
      expect(writes).toEqual({});
      expect(out.join('\n')).toContain('no longer read');
    });

    it('pre-selects config-file in the interactive picker when a config file already exists', async () => {
      const { io } = fakeIO({ isTTY: true, files: { '/proj/svelte-vitals.config.ts': 'x' } });
      let seenDefaults: string[] = [];
      const prompts: InstallPrompts = {
        ...noPrompts,
        selectClients: async (_groups, defaults) => {
          seenDefaults = defaults;
          return null;
        }
      };
      await runInstall({}, io, prompts);
      expect(seenDefaults).toContain('config-file');
    });

    it('a read failure (e.g. EACCES) while planning the config-file target is reported and exits 2', async () => {
      const { io, writes, err } = fakeIO({ throwOnRead: '/proj/svelte-vitals.config.js' });
      const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
      expect(code).toBe(2);
      expect(writes).toEqual({});
      expect(err.join('\n')).toContain('could not check existing config file');
      expect(err.join('\n')).toContain('EACCES');
    });
  });
});

describe('runInstall — ci-workflow target', () => {
  it('ci-workflow: not present → created, content calls @svelte-vitals/action', async () => {
    const { io, writes } = fakeIO();
    const code = await runInstall({ client: ['ci-workflow'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    const content = writes['/proj/.github/workflows/svelte-vitals.yml'];
    expect(content).toContain('name: svelte-vitals');
    expect(content).toContain('oekazuma/svelte-vitals-action@');
  });

  it('a second run without --force reports exists and writes nothing', async () => {
    const first = fakeIO();
    await runInstall({ client: ['ci-workflow'], yes: true }, first.io, noPrompts);
    const existing = first.writes['/proj/.github/workflows/svelte-vitals.yml']!;
    const { io, writes, out } = fakeIO({ files: { '/proj/.github/workflows/svelte-vitals.yml': existing } });
    const code = await runInstall({ client: ['ci-workflow'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already configured');
    expect(out.join('\n')).toContain('--force to overwrite');
  });

  it('--force regenerates an already-existing workflow file', async () => {
    const { io, writes } = fakeIO({
      files: { '/proj/.github/workflows/svelte-vitals.yml': 'stale content' }
    });
    const code = await runInstall({ client: ['ci-workflow'], yes: true, force: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes['/proj/.github/workflows/svelte-vitals.yml']).toContain('name: svelte-vitals');
    expect(writes['/proj/.github/workflows/svelte-vitals.yml']).not.toBe('stale content');
  });

  it('dry-run does not write the workflow file', async () => {
    const { io, writes, out } = fakeIO();
    const code = await runInstall({ client: ['ci-workflow'], dryRun: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run');
  });

  it('a plan can mix an agent skill and the ci-workflow target in one run', async () => {
    const { io, writes } = fakeIO();
    await runInstall({ client: ['cursor-rules', 'ci-workflow'], yes: true }, io, noPrompts);
    expect(Object.keys(writes).sort()).toEqual([MDC_PATH, '/proj/.github/workflows/svelte-vitals.yml']);
  });

  it('interactive picker options include the ci-workflow target, grouped under "CI (GitHub Actions)"', async () => {
    const { io } = fakeIO({ isTTY: true });
    let seenGroups: Record<string, string[]> = {};
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectClients: async (groups) => {
        seenGroups = Object.fromEntries(Object.entries(groups).map(([group, opts]) => [group, opts.map((o) => o.id)]));
        return null;
      }
    };
    await runInstall({}, io, prompts);
    expect(seenGroups['CI (GitHub Actions)']).toEqual(['ci-workflow']);
  });

  it('pre-selects ci-workflow in the interactive picker when the workflow file already exists', async () => {
    const { io } = fakeIO({ isTTY: true, files: { '/proj/.github/workflows/svelte-vitals.yml': 'existing' } });
    let seenDefaults: string[] = [];
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectClients: async (_groups, defaults) => {
        seenDefaults = defaults;
        return null;
      }
    };
    await runInstall({}, io, prompts);
    expect(seenDefaults).toContain('ci-workflow');
  });

  it('a read failure (e.g. EACCES) while planning the ci-workflow target is reported and exits 2', async () => {
    const { io, writes, err } = fakeIO({ throwOnRead: '/proj/.github/workflows/svelte-vitals.yml' });
    const code = await runInstall({ client: ['ci-workflow'], yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain('could not check existing workflow');
    expect(err.join('\n')).toContain('EACCES');
  });
});

describe('runInstall — grouped interactive picker', () => {
  it('groups options by category: Vite integration, Agent rules, CI, Config file', async () => {
    const { io } = fakeIO({ isTTY: true });
    let seenGroupNames: string[] = [];
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectClients: async (groups) => {
        seenGroupNames = Object.keys(groups);
        return null;
      }
    };
    await runInstall({}, io, prompts);
    expect(seenGroupNames).toEqual(['Vite integration', 'Agent rules', 'CI (GitHub Actions)', 'Config file']);
  });
});

describe('runInstall — monorepo app resolution (vite/config targets)', () => {
  it('cwd itself is a SvelteKit app → no discovery, writes stay at cwd', async () => {
    let discoveryCalls = 0;
    const { io, writes } = fakeIO({
      files: { '/proj/svelte.config.js': 'export default {};' },
      discoverApps: async () => {
        discoveryCalls++;
        return ['apps/web'];
      }
    });
    const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(discoveryCalls).toBe(0);
    expect(writes['/proj/svelte-vitals.config.js']).toBeDefined();
  });

  it('exactly one app detected → used automatically with a notice, config lands in the app dir', async () => {
    const { io, writes, err } = fakeIO({
      files: { '/proj/apps/web/svelte.config.js': 'export default {};' },
      discoverApps: async () => ['apps/web']
    });
    const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(err.join('\n')).toContain('detected SvelteKit app at apps/web');
    expect(writes['/proj/apps/web/svelte-vitals.config.js']).toBeDefined();
    expect(writes['/proj/svelte-vitals.config.js']).toBeUndefined();
  });

  it("vite-plugin's candidate lookup and manual snippet path are app-relative", async () => {
    const { io, writes, out } = fakeIO({
      files: { '/proj/apps/web/svelte.config.js': 'export default {};' },
      discoverApps: async () => ['apps/web']
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('/proj/apps/web/vite.config.ts');
  });

  it('several apps, non-interactive → exit 2 pointing at --app', async () => {
    const { io, writes, err } = fakeIO({
      files: {
        '/proj/apps/web/svelte.config.js': 'x',
        '/proj/apps/admin/svelte.config.js': 'x'
      },
      discoverApps: async () => ['apps/admin', 'apps/web']
    });
    const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain('multiple SvelteKit apps found');
    expect(err.join('\n')).toContain('--app');
  });

  it('several apps on a TTY → selectApp prompt decides the app dir', async () => {
    let promptedWith: string[] = [];
    const prompts: InstallPrompts = {
      ...noPrompts,
      selectApp: async (apps) => {
        promptedWith = apps;
        return 'apps/admin';
      }
    };
    const { io, writes } = fakeIO({
      isTTY: true,
      files: {
        '/proj/apps/web/svelte.config.js': 'x',
        '/proj/apps/admin/svelte.config.js': 'x'
      },
      discoverApps: async () => ['apps/admin', 'apps/web']
    });
    const code = await runInstall({ client: ['config-file'], yes: true }, io, prompts);
    expect(code).toBe(0);
    expect(promptedWith).toEqual(['apps/admin', 'apps/web']);
    expect(writes['/proj/apps/admin/svelte-vitals.config.js']).toBeDefined();
  });

  it('cancelling the app picker exits 0 without writing', async () => {
    const prompts: InstallPrompts = { ...noPrompts, selectApp: async () => null };
    const { io, writes, out } = fakeIO({
      isTTY: true,
      files: {
        '/proj/apps/web/svelte.config.js': 'x',
        '/proj/apps/admin/svelte.config.js': 'x'
      },
      discoverApps: async () => ['apps/admin', 'apps/web']
    });
    const code = await runInstall({ client: ['config-file'], yes: true }, io, prompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Cancelled');
  });

  it('--app skips detection and targets the named app', async () => {
    let discoveryCalls = 0;
    const { io, writes } = fakeIO({
      files: {
        '/proj/apps/web/svelte.config.js': 'x',
        '/proj/apps/admin/svelte.config.ts': 'x'
      },
      discoverApps: async () => {
        discoveryCalls++;
        return ['apps/admin', 'apps/web'];
      }
    });
    const code = await runInstall({ client: ['config-file'], app: 'apps/admin', yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(discoveryCalls).toBe(0);
    expect(writes['/proj/apps/admin/svelte-vitals.config.js']).toBeDefined();
  });

  it('--app pointing at a non-SvelteKit dir is a fatal error (exit 2)', async () => {
    const { io, writes, err } = fakeIO();
    const code = await runInstall({ client: ['config-file'], app: 'packages/lib', yes: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain("--app 'packages/lib' is not a SvelteKit app");
  });

  it('--app targets an app with no svelte.config.{js,ts}, detected via @sveltejs/kit in package.json', async () => {
    // current `sv create` output folds SvelteKit config into vite.config.ts and emits no
    // separate svelte.config file — the --app validation must not depend on that file existing.
    const { io, writes } = fakeIO({
      files: {
        '/proj/apps/mobile/package.json': JSON.stringify({ devDependencies: { '@sveltejs/kit': '^2.63.0' } })
      }
    });
    const code = await runInstall({ client: ['config-file'], app: 'apps/mobile', yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes['/proj/apps/mobile/svelte-vitals.config.js']).toBeDefined();
  });

  it('root-scoped targets are unaffected: the rules file stays at cwd while the config file goes into the app', async () => {
    const { io, writes } = fakeIO({
      files: { '/proj/apps/web/svelte.config.js': 'x' },
      discoverApps: async () => ['apps/web']
    });
    const code = await runInstall({ client: ['cursor-rules', 'config-file'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(Object.keys(writes).sort()).toEqual([MDC_PATH, '/proj/apps/web/svelte-vitals.config.js']);
  });

  it('no apps found anywhere → previous behavior, writes at cwd', async () => {
    const { io, writes } = fakeIO({ discoverApps: async () => [] });
    const code = await runInstall({ client: ['config-file'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes['/proj/svelte-vitals.config.js']).toBeDefined();
  });

  it('targets without app scope never trigger discovery', async () => {
    let discoveryCalls = 0;
    const { io } = fakeIO({
      discoverApps: async () => {
        discoveryCalls++;
        return ['apps/web'];
      }
    });
    await runInstall({ client: ['cursor-rules', 'ci-workflow'], yes: true }, io, noPrompts);
    expect(discoveryCalls).toBe(0);
  });

  it('the vite auto-install runs in the app dir and detects the PM from the root lockfile', async () => {
    const viteConfig = `
import { sveltekit } from '@sveltejs/kit/vite';
export default { plugins: [sveltekit()] };
`;
    const runCalls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const { io, writes } = fakeIO({
      files: {
        '/proj/pnpm-lock.yaml': '',
        '/proj/apps/web/svelte.config.js': 'x',
        '/proj/apps/web/vite.config.ts': viteConfig,
        '/proj/apps/web/package.json': '{}'
      },
      discoverApps: async () => ['apps/web'],
      runCommand: (command, args, cwd) => {
        runCalls.push({ command, args, cwd });
        return 0;
      }
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes['/proj/apps/web/vite.config.ts']).toContain('svelteVitals()');
    expect(runCalls).toEqual([{ command: 'pnpm', args: ['add', '-D', '@svelte-vitals/vite'], cwd: '/proj/apps/web' }]);
  });

  it('an app with its own package-lock.json keeps npm even when the repo root uses pnpm', async () => {
    const viteConfig = `
import { sveltekit } from '@sveltejs/kit/vite';
export default { plugins: [sveltekit()] };
`;
    const runCalls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const { io } = fakeIO({
      files: {
        '/proj/pnpm-lock.yaml': '',
        '/proj/apps/web/package-lock.json': '{}',
        '/proj/apps/web/svelte.config.js': 'x',
        '/proj/apps/web/vite.config.ts': viteConfig,
        '/proj/apps/web/package.json': '{}'
      },
      discoverApps: async () => ['apps/web'],
      runCommand: (command, args, cwd) => {
        runCalls.push({ command, args, cwd });
        return 0;
      }
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(runCalls).toEqual([
      { command: 'npm', args: ['install', '-D', '@svelte-vitals/vite'], cwd: '/proj/apps/web' }
    ]);
  });
});

describe('runInstall — --refresh', () => {
  it('the rules file present → regenerated with the current version', async () => {
    const { io, writes } = fakeIO({ files: { [MDC_PATH]: 'stale rules content' } });
    const code = await runInstall({ refresh: true }, io, noPrompts, '2.0.0');
    expect(code).toBe(0);
    expect(writes[MDC_PATH]).toContain('svelte-vitals 2.0.0');
  });

  it('a SKILL.md written by the retired installer targets is no longer refreshed', async () => {
    const { io, writes, err } = fakeIO({
      files: { '/proj/.claude/skills/svelte-vitals/SKILL.md': 'stale skill content' }
    });
    const code = await runInstall({ refresh: true }, io, noPrompts, '2.0.0');
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain('no generated agent files found');
  });

  it('no generated agent files present → prints guidance to stderr and exits 0 without writing', async () => {
    const { io, writes, err } = fakeIO();
    const code = await runInstall({ refresh: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain('no generated agent files found');
    expect(err.join('\n')).toContain('svelte-vitals install --client cursor-rules');
  });

  it('--dry-run previews the plan and writes nothing', async () => {
    const { io, writes, out } = fakeIO({ files: { [MDC_PATH]: 'stale rules content' } });
    const code = await runInstall({ refresh: true, dryRun: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run');
  });

  it('leaves files it did not generate untouched', async () => {
    const { io, writes } = fakeIO({
      files: {
        [MDC_PATH]: 'stale rules content',
        '/proj/.mcp.json': JSON.stringify({ mcpServers: { other: { command: 'x', args: [] } } }),
        '/proj/svelte-vitals.config.js': 'export default {};'
      }
    });
    const code = await runInstall({ refresh: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(writes[MDC_PATH]).toBeDefined();
    expect(writes['/proj/.mcp.json']).toBeUndefined();
    expect(writes['/proj/svelte-vitals.config.js']).toBeUndefined();
  });

  it('a per-file write failure is reported and exits 2', async () => {
    const { io, writes, err } = fakeIO({
      files: { [MDC_PATH]: 'stale rules content' },
      failWritePath: MDC_PATH
    });
    const code = await runInstall({ refresh: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes[MDC_PATH]).toBeUndefined();
    expect(err.join('\n')).toContain(MDC_PATH);
  });

  it('a read failure is not counted as an existing file: with no readable targets, exits 2 without the zero-files guidance', async () => {
    const { io, writes, err } = fakeIO({ throwOnRead: MDC_PATH });
    const code = await runInstall({ refresh: true }, io, noPrompts);
    expect(code).toBe(2);
    expect(writes).toEqual({});
    expect(err.join('\n')).toContain(`failed to read ${MDC_PATH}`);
    // The "nothing installed yet" guidance would be misleading when a read failed.
    expect(err.join('\n')).not.toContain('no generated agent files found');
  });
});
