# Install wizard — Vite plugin targets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `npx svelte-vitals install` so it can also register `@svelte-vitals/vite`'s build-mode plugin in `vite.config.ts` and its dev-overlay hook in `src/hooks.server.ts`, installing the package if needed, using a `magicast` codemod that always falls back to "print a snippet, don't touch the file" on any shape it doesn't confidently recognize.

**Architecture:** Two new pure codemod functions (`codemodViteConfig`, `codemodHooksServer`) take the existing file content (or `undefined`) and return a `{ status, content?, snippet? }` result — no file I/O, no prompts, fully unit-testable. `runInstall` in `src/install/index.ts` is extended to treat `'vite-plugin'` and `'vite-dev-overlay'` as two more selectable target ids alongside the existing MCP client ids, building a `PlanRow` for each the same way it already does for clients. A small `package-manager.ts` module detects the project's package manager from its lockfile and, after a successful write, installs `@svelte-vitals/vite` if it isn't already a dependency.

**Tech Stack:** TypeScript (ESM), `magicast` (new dependency, AST-safe codemod on JS/TS source — already resolves in the workspace lockfile as a transitive dependency, so no new version-resolution risk), `vitest`, `@clack/prompts` (already a dependency), `node:child_process.spawnSync` (package-manager install, no new dependency).

## Global Constraints

- **Never write invalid or semantically-wrong source.** Any shape the codemod doesn't confidently recognize must be left untouched (`status: 'manual'`), never guessed at.
- **`magicast`'s `.some()` / `.every()` do not work on its Proxified arrays** — verified empirically: the callback is never invoked and the result is always `false`. Always use `.find(...) !== undefined` (or `.push`/`.unshift`/`for...of`, which do work) for existence checks on a Proxified array. This applies to every codemod task below.
- **`--force` does not apply to the two new targets.** An already-present `svelteVitals()` / `svelteVitalsHandle()` registration is always reported as `'exists'` and left alone, regardless of `--force` (only the three MCP-client targets honor `--force`, unchanged from today).
- Package manager install commands: `pnpm add -D`, `yarn add -D`, `bun add -D`, but **`npm install -D`** (`npm add` is not a real npm command).
- ESM-only throughout (this package is ESM-only by design — see `tsup.config.ts`'s comment).
- ~~No new flags~~ — `--client` is reused; its accepted values are extended, not renamed.

---

## Task 1: Vite target metadata

**Files:**

- Create: `packages/cli/src/install/vite-targets.ts`
- Test: `packages/cli/test/install/vite-targets.test.ts`

**Interfaces:**

- Produces: `ViteTargetId = 'vite-plugin' | 'vite-dev-overlay'`, `ViteTarget { id: ViteTargetId; label: string; hint: string }`, `VITE_TARGETS: ViteTarget[]`, `viteTargetById(id: string): ViteTarget | undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/test/install/vite-targets.test.ts
import { describe, it, expect } from 'vitest';
import { VITE_TARGETS, viteTargetById } from '../../src/install/vite-targets.js';

describe('vite targets', () => {
  it('has both targets with distinct ids', () => {
    expect(VITE_TARGETS.map((t) => t.id).sort()).toEqual(['vite-dev-overlay', 'vite-plugin']);
  });
  it('each target has a non-empty label and hint', () => {
    for (const t of VITE_TARGETS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
    }
  });
  it('viteTargetById resolves a known id', () => {
    expect(viteTargetById('vite-plugin')?.label).toBe('Vite plugin (build gate)');
  });
  it('viteTargetById returns undefined for an unknown id', () => {
    expect(viteTargetById('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/vite-targets.test.ts`
Expected: FAIL — `Cannot find module '../../src/install/vite-targets.js'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/cli/src/install/vite-targets.ts
export type ViteTargetId = 'vite-plugin' | 'vite-dev-overlay';

export interface ViteTarget {
  id: ViteTargetId;
  label: string;
  hint: string;
}

export const VITE_TARGETS: ViteTarget[] = [
  {
    id: 'vite-plugin',
    label: 'Vite plugin (build gate)',
    hint: 'Fails `vite build` when prerendered pages cross the SEO/Performance threshold'
  },
  {
    id: 'vite-dev-overlay',
    label: 'Dev overlay',
    hint: 'Live warnings in `vite dev` only — never fails a build or CI'
  }
];

export function viteTargetById(id: string): ViteTarget | undefined {
  return VITE_TARGETS.find((t) => t.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/vite-targets.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/install/vite-targets.ts packages/cli/test/install/vite-targets.test.ts
git commit -m "feat(cli): add Vite install-target metadata"
```

---

## Task 2: `vite.config` codemod

**Files:**

- Create: `packages/cli/src/install/codemod-types.ts`
- Create: `packages/cli/src/install/codemod-vite-config.ts`
- Test: `packages/cli/test/install/codemod-vite-config.test.ts`
- Modify: `packages/cli/package.json` (add `magicast` dependency)
- Modify: `pnpm-workspace.yaml` (add `magicast` to the catalog)

**Interfaces:**

- Produces: `WriteStatus = 'created' | 'added' | 'exists' | 'updated' | 'manual'`, `CodemodResult { status: WriteStatus; content?: string; snippet?: string }`, `codemodViteConfig(existing: string | undefined): CodemodResult`.

- [ ] **Step 1: Add the `magicast` dependency**

In `pnpm-workspace.yaml`, add to the `catalog:` block (alphabetical, matching the existing style):

```yaml
magicast: ^0.5.3
```

In `packages/cli/package.json`, add to `dependencies` (alphabetical):

```json
    "magicast": "catalog:",
```

Run: `pnpm install`
Expected: lockfile updates, no errors (this version is already resolved elsewhere in the workspace as a transitive dependency, so this should not change any other package's resolved version).

- [ ] **Step 2: Write the shared codemod result type**

```ts
// packages/cli/src/install/codemod-types.ts
export type WriteStatus = 'created' | 'added' | 'exists' | 'updated' | 'manual';

export interface CodemodResult {
  status: WriteStatus;
  /** New file content to write. Absent when status is 'manual' (nothing is written). */
  content?: string;
  /** Snippet to show the user when status is 'manual'. */
  snippet?: string;
}
```

- [ ] **Step 3: Write the failing tests**

```ts
// packages/cli/test/install/codemod-vite-config.test.ts
import { describe, it, expect } from 'vitest';
import { codemodViteConfig } from '../../src/install/codemod-vite-config.js';

describe('codemodViteConfig', () => {
  it('file does not exist → manual, with a snippet', () => {
    const result = codemodViteConfig(undefined);
    expect(result.status).toBe('manual');
    expect(result.content).toBeUndefined();
    expect(result.snippet).toContain("import { svelteVitals } from '@svelte-vitals/vite';");
  });

  it('defineConfig({ plugins: [...] }) → added, plugin unshifted, import added', () => {
    const src = `
import { defineConfig } from 'astro/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()]
});
`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain("import { svelteVitals } from '@svelte-vitals/vite';");
    expect(result.content).toMatch(/plugins:\s*\[svelteVitals\(\), sveltekit\(\)\]/);
  });

  it('plain object export default with plugins array → added', () => {
    const src = `export default { plugins: [] };`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain('svelteVitals()');
  });

  it('svelteVitals already registered → exists, no content', () => {
    const src = `
import { svelteVitals } from '@svelte-vitals/vite';
export default { plugins: [svelteVitals({ failOn: 'critical' }), sveltekit()] };
`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('exists');
    expect(result.content).toBeUndefined();
  });

  it('no plugins array → manual, original file untouched', () => {
    const src = `export default { server: {} };`;
    const result = codemodViteConfig(src);
    expect(result.status).toBe('manual');
    expect(result.content).toBeUndefined();
  });

  it('a shape magicast cannot parse into a recognizable default export → manual, no throw', () => {
    const src = `export default (() => ({ plugins: [] }))();`;
    expect(() => codemodViteConfig(src)).not.toThrow();
    expect(codemodViteConfig(src).status).toBe('manual');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/codemod-vite-config.test.ts`
Expected: FAIL — `Cannot find module '../../src/install/codemod-vite-config.js'`

- [ ] **Step 5: Write the implementation**

```ts
// packages/cli/src/install/codemod-vite-config.ts
import { parseModule, generateCode, builders, MagicastError } from 'magicast';
import type { CodemodResult } from './codemod-types.js';

const MANUAL_SNIPPET = `import { svelteVitals } from '@svelte-vitals/vite';
// add svelteVitals() to your \`plugins\` array`;

/**
 * Register the svelte-vitals build-mode plugin in a vite.config source.
 * Returns 'manual' (no content) when the file is missing, or its shape isn't a
 * recognized `export default { plugins: [...] }` / `defineConfig({ plugins: [...] })`.
 */
export function codemodViteConfig(existing: string | undefined): CodemodResult {
  if (existing === undefined) {
    return { status: 'manual', snippet: MANUAL_SNIPPET };
  }
  try {
    const mod = parseModule(existing);
    if (mod.imports.svelteVitals) {
      return { status: 'exists' };
    }
    const def = mod.exports.default;
    const configObj = def?.$type === 'function-call' ? def.$args[0] : def;
    if (!configObj || configObj.$type !== 'object' || configObj.plugins?.$type !== 'array') {
      return { status: 'manual', snippet: MANUAL_SNIPPET };
    }
    // NB: .find(), not .some() — magicast's Proxified arrays don't invoke .some()'s callback (see Global Constraints).
    const already = configObj.plugins.find(
      (p: { $type?: string; $callee?: string }) => p?.$type === 'function-call' && p?.$callee === 'svelteVitals'
    );
    if (already !== undefined) {
      return { status: 'exists' };
    }
    mod.imports.$append({ imported: 'svelteVitals', local: 'svelteVitals', from: '@svelte-vitals/vite' });
    configObj.plugins.unshift(builders.functionCall('svelteVitals'));
    return { status: 'added', content: generateCode(mod).code };
  } catch (err) {
    if (err instanceof MagicastError) {
      return { status: 'manual', snippet: MANUAL_SNIPPET };
    }
    throw err;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/codemod-vite-config.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml packages/cli/package.json pnpm-lock.yaml \
  packages/cli/src/install/codemod-types.ts packages/cli/src/install/codemod-vite-config.ts \
  packages/cli/test/install/codemod-vite-config.test.ts
git commit -m "feat(cli): add magicast codemod to register the Vite plugin in vite.config"
```

---

## Task 3: `hooks.server.ts` codemod

**Files:**

- Create: `packages/cli/src/install/codemod-hooks.ts`
- Test: `packages/cli/test/install/codemod-hooks.test.ts`

**Interfaces:**

- Consumes: `WriteStatus`, `CodemodResult` from `./codemod-types.js` (Task 2).
- Produces: `codemodHooksServer(existing: string | undefined): CodemodResult`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/cli/test/install/codemod-hooks.test.ts
import { describe, it, expect } from 'vitest';
import { codemodHooksServer } from '../../src/install/codemod-hooks.js';

describe('codemodHooksServer', () => {
  it('file does not exist → created, with a fresh sequence(handle)', () => {
    const result = codemodHooksServer(undefined);
    expect(result.status).toBe('created');
    expect(result.content).toContain("import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';");
    expect(result.content).toMatch(/export const handle = sequence\(svelteVitalsHandle\(\)\)/);
  });

  it('existing sequence(...) call → added, appended as the last argument', () => {
    const src = `
import { sequence } from '@sveltejs/kit/hooks';
import { authHandle } from '$lib/auth';

export const handle = sequence(authHandle);
`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain("import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';");
    expect(result.content).toMatch(/sequence\(authHandle, svelteVitalsHandle\(\)\)/);
  });

  it('svelteVitalsHandle already in the sequence → exists, no content', () => {
    const src = `
import { sequence } from '@sveltejs/kit/hooks';
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
export const handle = sequence(authHandle, svelteVitalsHandle());
`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('exists');
    expect(result.content).toBeUndefined();
  });

  it('bare (non-sequence) handle export → updated, wrapped in sequence(...)', () => {
    const src = `export const handle = async ({ event, resolve }) => resolve(event);`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('updated');
    expect(result.content).toContain("import { sequence } from '@sveltejs/kit/hooks';");
    expect(result.content).toContain("import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';");
    expect(result.content).toMatch(
      /export const handle = sequence\(async \(\{ event, resolve \}\) => resolve\(event\), svelteVitalsHandle\(\)\)/
    );
  });

  it('file exists but has no handle export → added, a fresh handle appended', () => {
    const src = `export function handleError() {}`;
    const result = codemodHooksServer(src);
    expect(result.status).toBe('added');
    expect(result.content).toContain('export function handleError() {}');
    expect(result.content).toMatch(/export const handle = sequence\(svelteVitalsHandle\(\)\)/);
  });

  it('a shape magicast cannot parse → manual, no throw', () => {
    const src = `export const handle = (() => async (e) => e.resolve())();`;
    expect(() => codemodHooksServer(src)).not.toThrow();
    expect(codemodHooksServer(src).status).toBe('manual');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/codemod-hooks.test.ts`
Expected: FAIL — `Cannot find module '../../src/install/codemod-hooks.js'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/cli/src/install/codemod-hooks.ts
import { parseModule, generateCode, builders, MagicastError } from 'magicast';
import type { CodemodResult } from './codemod-types.js';

const FRESH_HANDLE = `import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(svelteVitalsHandle());
`;

const MANUAL_SNIPPET = `import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';
// wrap your existing \`handle\` in sequence(yourHandle, svelteVitalsHandle())`;

function addImports(mod: ReturnType<typeof parseModule>): void {
  if (!mod.imports.sequence) {
    mod.imports.$append({ imported: 'sequence', local: 'sequence', from: '@sveltejs/kit/hooks' });
  }
  if (!mod.imports.svelteVitalsHandle) {
    mod.imports.$append({
      imported: 'svelteVitalsHandle',
      local: 'svelteVitalsHandle',
      from: '@svelte-vitals/vite/hooks'
    });
  }
}

/**
 * Register the svelte-vitals dev-overlay handle in a hooks.server source.
 * Returns 'manual' (no content) when the existing `handle` export's shape
 * isn't one of: absent, `sequence(...)`, or a single handle expression.
 */
export function codemodHooksServer(existing: string | undefined): CodemodResult {
  if (existing === undefined) {
    return { status: 'created', content: FRESH_HANDLE };
  }
  try {
    const mod = parseModule(existing);
    const handle = mod.exports.handle;

    if (handle === undefined) {
      addImports(mod);
      mod.exports.handle = builders.functionCall('sequence', builders.functionCall('svelteVitalsHandle'));
      return { status: 'added', content: generateCode(mod).code };
    }

    if (handle.$type === 'function-call' && handle.$callee === 'sequence') {
      // NB: .find(), not .some() — see Global Constraints.
      const already = handle.$args.find(
        (a: { $type?: string; $callee?: string }) => a?.$type === 'function-call' && a?.$callee === 'svelteVitalsHandle'
      );
      if (already !== undefined) {
        return { status: 'exists' };
      }
      if (!mod.imports.svelteVitalsHandle) {
        mod.imports.$append({
          imported: 'svelteVitalsHandle',
          local: 'svelteVitalsHandle',
          from: '@svelte-vitals/vite/hooks'
        });
      }
      handle.$args.push(builders.functionCall('svelteVitalsHandle'));
      return { status: 'added', content: generateCode(mod).code };
    }

    // A single, non-sequence handle expression: wrap it.
    addImports(mod);
    mod.exports.handle = builders.functionCall('sequence', handle, builders.functionCall('svelteVitalsHandle'));
    return { status: 'updated', content: generateCode(mod).code };
  } catch (err) {
    if (err instanceof MagicastError) {
      return { status: 'manual', snippet: MANUAL_SNIPPET };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/codemod-hooks.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/install/codemod-hooks.ts packages/cli/test/install/codemod-hooks.test.ts
git commit -m "feat(cli): add magicast codemod to register the dev-overlay hook"
```

---

## Task 4: Package-manager detection & install

**Files:**

- Create: `packages/cli/src/install/package-manager.ts`
- Test: `packages/cli/test/install/package-manager.test.ts`

**Interfaces:**

- Produces: `PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm'`, `detectPackageManager(io: { cwd: string; readFile(path: string): string | undefined }): PackageManager`, `hasVitePackage(io: { cwd: string; readFile(path: string): string | undefined }): boolean`, `installCommand(pm: PackageManager): { command: string; args: string[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/cli/test/install/package-manager.test.ts
import { describe, it, expect } from 'vitest';
import { detectPackageManager, hasVitePackage, installCommand } from '../../src/install/package-manager.js';

function fakeReadCwd(files: Record<string, string>) {
  return {
    cwd: '/proj',
    readFile: (p: string) => files[p]
  };
}

describe('detectPackageManager', () => {
  it('detects pnpm from pnpm-lock.yaml', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/pnpm-lock.yaml': '' }))).toBe('pnpm');
  });
  it('detects yarn from yarn.lock', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/yarn.lock': '' }))).toBe('yarn');
  });
  it('detects bun from bun.lockb', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/bun.lockb': '' }))).toBe('bun');
  });
  it('falls back to npm when no lockfile is found', () => {
    expect(detectPackageManager(fakeReadCwd({}))).toBe('npm');
  });
});

describe('hasVitePackage', () => {
  it('true when @svelte-vitals/vite is a devDependency', () => {
    const io = fakeReadCwd({
      '/proj/package.json': JSON.stringify({ devDependencies: { '@svelte-vitals/vite': '^1.0.0' } })
    });
    expect(hasVitePackage(io)).toBe(true);
  });
  it('true when @svelte-vitals/vite is a dependency', () => {
    const io = fakeReadCwd({
      '/proj/package.json': JSON.stringify({ dependencies: { '@svelte-vitals/vite': '^1.0.0' } })
    });
    expect(hasVitePackage(io)).toBe(true);
  });
  it('false when package.json exists but lacks the package', () => {
    const io = fakeReadCwd({ '/proj/package.json': JSON.stringify({ devDependencies: {} }) });
    expect(hasVitePackage(io)).toBe(false);
  });
  it('false when package.json does not exist', () => {
    expect(hasVitePackage(fakeReadCwd({}))).toBe(false);
  });
  it('false (not thrown) when package.json is unparseable', () => {
    const io = fakeReadCwd({ '/proj/package.json': '{not json' });
    expect(() => hasVitePackage(io)).not.toThrow();
    expect(hasVitePackage(io)).toBe(false);
  });
});

describe('installCommand', () => {
  it('npm uses "install", not "add"', () => {
    expect(installCommand('npm')).toEqual({ command: 'npm', args: ['install', '-D', '@svelte-vitals/vite'] });
  });
  it('pnpm/yarn/bun use "add"', () => {
    expect(installCommand('pnpm')).toEqual({ command: 'pnpm', args: ['add', '-D', '@svelte-vitals/vite'] });
    expect(installCommand('yarn')).toEqual({ command: 'yarn', args: ['add', '-D', '@svelte-vitals/vite'] });
    expect(installCommand('bun')).toEqual({ command: 'bun', args: ['add', '-D', '@svelte-vitals/vite'] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/package-manager.test.ts`
Expected: FAIL — `Cannot find module '../../src/install/package-manager.js'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/cli/src/install/package-manager.ts
import { join } from 'node:path';

export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm';

interface ReadCwd {
  cwd: string;
  readFile(path: string): string | undefined;
}

const LOCKFILE_TO_PM: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun'
};

/** Detect the project's package manager from its lockfile; defaults to npm. */
export function detectPackageManager(io: ReadCwd): PackageManager {
  for (const [file, pm] of Object.entries(LOCKFILE_TO_PM)) {
    if (io.readFile(join(io.cwd, file)) !== undefined) return pm;
  }
  return 'npm';
}

/** Whether @svelte-vitals/vite is already a (dev)dependency in package.json. */
export function hasVitePackage(io: ReadCwd): boolean {
  const raw = io.readFile(join(io.cwd, 'package.json'));
  if (raw === undefined) return false;
  try {
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(pkg.dependencies?.['@svelte-vitals/vite'] || pkg.devDependencies?.['@svelte-vitals/vite']);
  } catch {
    return false;
  }
}

/** Build the install-as-devDependency command for a package manager. npm uses `install`, not `add`. */
export function installCommand(pm: PackageManager): { command: string; args: string[] } {
  const action = pm === 'npm' ? 'install' : 'add';
  return { command: pm, args: [action, '-D', '@svelte-vitals/vite'] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/package-manager.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/install/package-manager.ts packages/cli/test/install/package-manager.test.ts
git commit -m "feat(cli): add package-manager detection for auto-installing @svelte-vitals/vite"
```

---

## Task 5: Wire Vite targets into `runInstall`

**Files:**

- Modify: `packages/cli/src/install/clients.ts` (broaden `clientById`'s parameter type)
- Modify: `packages/cli/src/install/index.ts` (full rewrite of the orchestration — shown in full below)
- Modify: `packages/cli/test/install/run.test.ts` (new tests appended; existing tests must keep passing unchanged)

**Interfaces:**

- Consumes: `VITE_TARGETS`, `ViteTargetId`, `viteTargetById` (Task 1); `codemodViteConfig` (Task 2); `codemodHooksServer` (Task 3); `detectPackageManager`, `hasVitePackage`, `installCommand` (Task 4).
- Produces: `TargetId = ClientId | ViteTargetId` (exported from `index.ts`); `InstallIO.runCommand?(command: string, args: string[], cwd: string): number` (new **optional** method — existing `fakeIO()` test helpers that omit it keep working); `InstallFlags.client?: TargetId[]` (widened from `ClientId[]`); `InstallPrompts.selectClients(all: { id: TargetId; label: string; hint?: string }[], defaults: TargetId[]): Promise<TargetId[] | null>` (widened, same method name).

- [ ] **Step 1: Broaden `clientById`**

In `packages/cli/src/install/clients.ts`, change:

```ts
export function clientById(id: ClientId): ClientWriter | undefined {
```

to:

```ts
export function clientById(id: string): ClientWriter | undefined {
```

(The body is unchanged — `CLIENTS.find((c) => c.id === id)` already works for a plain `string`. This lets `index.ts` call it with the broader `TargetId` without a cast.)

- [ ] **Step 2: Write the new failing tests (appended to `run.test.ts`)**

Add these `describe` blocks to the end of `packages/cli/test/install/run.test.ts` (keep the existing `fakeIO`, `noPrompts`, and all existing tests as-is):

```ts
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
  });

  it('vite-dev-overlay: no hooks.server.ts → created', async () => {
    const { io, writes } = fakeIO({ files: { '/proj/package.json': '{}' }, runCommand: () => 0 });
    await runInstall({ client: ['vite-dev-overlay'], yes: true }, io, noPrompts);
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

  it('a plan can mix an MCP client and a Vite target in one run', async () => {
    const { io, writes } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      runCommand: () => 0
    });
    await runInstall({ client: ['claude-code', 'vite-plugin'], scope: 'project', yes: true }, io, noPrompts);
    expect(Object.keys(writes).sort()).toEqual(['/proj/.mcp.json', '/proj/vite.config.ts']);
  });

  it('a failed package-manager install is reported but does not fail the run', async () => {
    const { io, err } = fakeIO({
      files: { '/proj/vite.config.ts': `export default { plugins: [] };`, '/proj/package.json': '{}' },
      runCommand: () => 1
    });
    const code = await runInstall({ client: ['vite-plugin'], yes: true }, io, noPrompts);
    expect(code).toBe(0);
    expect(err.join('\n')).toContain('@svelte-vitals/vite');
  });
});
```

- [ ] **Step 3: Extend the `fakeIO` test helper to accept `runCommand`**

In `packages/cli/test/install/run.test.ts`, change the `fakeIO` signature and body:

```ts
function fakeIO(
  over: {
    files?: Record<string, string>;
    isTTY?: boolean;
    failWritePath?: string;
    throwOnRead?: string;
    runCommand?: (command: string, args: string[], cwd: string) => number;
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
    home: '/home/u',
    isTTY: over.isTTY ?? false,
    log: (l) => out.push(l),
    errorLog: (l) => err.push(l),
    ...(over.runCommand ? { runCommand: over.runCommand } : {})
  };
  return { io, writes, out, err };
}
```

This is additive — every existing call to `fakeIO()` (with no `runCommand` override) is unaffected, and `io.runCommand` stays `undefined` for them, matching the new method being optional.

- [ ] **Step 4: Run the new tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/run.test.ts`
Expected: FAIL — `runInstall` doesn't yet recognize `'vite-plugin'` / `'vite-dev-overlay'` as valid ids (falls into "no valid clients selected", exit 2), and `InstallIO`/`InstallFlags` don't yet have the new members (TypeScript errors).

- [ ] **Step 5: Rewrite `index.ts`**

Replace the full contents of `packages/cli/src/install/index.ts` with:

```ts
import { join } from 'node:path';
import { CLIENTS, clientById, MCP_ENTRY, type ClientId, type ClientWriter, type Scope } from './clients.js';
import { mergeJson, mergeToml } from './merge.js';
import { VITE_TARGETS, type ViteTargetId } from './vite-targets.js';
import { codemodViteConfig } from './codemod-vite-config.js';
import { codemodHooksServer } from './codemod-hooks.js';
import { detectPackageManager, hasVitePackage, installCommand } from './package-manager.js';
import type { WriteStatus } from './codemod-types.js';

export type TargetId = ClientId | ViteTargetId;

export interface InstallIO {
  /** File contents, or undefined if the file does not exist. */
  readFile(path: string): string | undefined;
  /** Write the file, creating parent directories as needed. */
  writeFile(path: string, content: string): void;
  cwd: string;
  home: string;
  isTTY: boolean;
  log(line: string): void;
  errorLog(line: string): void;
  /** Run a command (used only to auto-install @svelte-vitals/vite). Returns the exit code. */
  runCommand?(command: string, args: string[], cwd: string): number;
}

export interface SelectableOption {
  id: TargetId;
  label: string;
  hint?: string;
}

export interface InstallPrompts {
  /** Returns chosen target ids (clients and/or Vite targets), or null when cancelled. */
  selectClients(all: SelectableOption[], defaults: TargetId[]): Promise<TargetId[] | null>;
  /** Returns chosen scope, or null when cancelled. */
  selectScope(client: ClientWriter): Promise<Scope | null>;
  confirm(planText: string): Promise<boolean>;
}

export interface InstallFlags {
  client?: TargetId[];
  scope?: Scope;
  yes?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

interface PlanRow {
  id: TargetId;
  label: string;
  scope?: Scope;
  path: string;
  status: WriteStatus;
  content?: string;
  snippet?: string;
}

function planForClient(client: ClientWriter, scope: Scope, io: InstallIO, force: boolean): PlanRow {
  const path = client.resolvePath(scope, io.cwd, io.home);
  const existing = io.readFile(path);
  const merged =
    client.format === 'toml' ? mergeToml(existing, MCP_ENTRY, force) : mergeJson(existing, MCP_ENTRY, force);
  return { id: client.id, label: client.label, scope, path, status: merged.status, content: merged.content };
}

/** Read the first candidate path that exists; otherwise report the first candidate as the (nonexistent) path. */
function resolveCandidate(io: InstallIO, candidates: string[]): { path: string; content: string | undefined } {
  for (const rel of candidates) {
    const path = join(io.cwd, rel);
    const content = io.readFile(path);
    if (content !== undefined) return { path, content };
  }
  return { path: join(io.cwd, candidates[0]!), content: undefined };
}

function planForVitePlugin(io: InstallIO): PlanRow {
  const { path, content } = resolveCandidate(io, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']);
  const result = codemodViteConfig(content);
  return { id: 'vite-plugin', label: 'Vite plugin (build gate)', path, ...result };
}

function planForDevOverlay(io: InstallIO): PlanRow {
  const { path, content } = resolveCandidate(io, ['src/hooks.server.ts', 'src/hooks.server.js']);
  const result = codemodHooksServer(content);
  return { id: 'vite-dev-overlay', label: 'Dev overlay', path, ...result };
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n');
}

function rowLine(r: PlanRow): string {
  const head = `  ${r.label}${r.scope ? ` (${r.scope})` : ''} → ${r.path}  [${r.status}]`;
  return r.status === 'manual' && r.snippet ? `${head}\n${indent(r.snippet)}` : head;
}

export async function runInstall(flags: InstallFlags, io: InstallIO, prompts: InstallPrompts): Promise<number> {
  // 1. Select clients / targets.
  let ids: TargetId[];
  if (flags.client && flags.client.length > 0) {
    ids = flags.client;
  } else if (io.isTTY) {
    const configExists = (path: string): boolean => {
      try {
        return io.readFile(path) !== undefined;
      } catch {
        return false;
      }
    };
    const detectedClients = CLIENTS.filter((c) =>
      c.scopes.some((s) => configExists(c.resolvePath(s, io.cwd, io.home)))
    ).map((c) => c.id);
    const viteConfigExists = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'].some((f) =>
      configExists(join(io.cwd, f))
    );
    const detected: TargetId[] = [
      ...detectedClients,
      ...(viteConfigExists ? (['vite-plugin', 'vite-dev-overlay'] as ViteTargetId[]) : [])
    ];
    const options: SelectableOption[] = [
      ...CLIENTS.map((c) => ({ id: c.id, label: c.label })),
      ...VITE_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint }))
    ];
    const picked = await prompts.selectClients(options, detected);
    if (picked === null) {
      io.log('Cancelled.');
      return 0;
    }
    ids = picked;
  } else {
    io.errorLog(
      'svelte-vitals: no TTY; pass --client <claude-code,cursor,codex,vite-plugin,vite-dev-overlay> to install non-interactively.'
    );
    return 2;
  }

  const clients = ids.map(clientById).filter((c): c is ClientWriter => c !== undefined);
  const viteIds = ids.filter((id): id is ViteTargetId => id === 'vite-plugin' || id === 'vite-dev-overlay');
  if (clients.length === 0 && viteIds.length === 0) {
    io.errorLog('svelte-vitals: no valid clients or targets selected.');
    return 2;
  }

  // 2. Resolve a scope per client and build the plan.
  const rows: PlanRow[] = [];
  for (const client of clients) {
    let scope: Scope;
    if (client.scopes.length === 1) {
      scope = client.scopes[0]!;
    } else if (flags.scope) {
      scope = flags.scope;
    } else if (io.isTTY) {
      const picked = await prompts.selectScope(client);
      if (picked === null) {
        io.log('Cancelled.');
        return 0;
      }
      scope = picked;
    } else {
      scope = 'project';
    }
    try {
      rows.push(planForClient(client, scope, io, flags.force ?? false));
    } catch (err) {
      const path = client.resolvePath(scope, io.cwd, io.home);
      io.errorLog(
        `svelte-vitals: could not parse existing config at ${path}: ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }
  for (const viteId of viteIds) {
    rows.push(viteId === 'vite-plugin' ? planForVitePlugin(io) : planForDevOverlay(io));
  }

  // 3. Preview.
  const planText = rows.map(rowLine).join('\n');
  io.log('Plan:');
  io.log(planText);

  // 4. Dry-run / confirm.
  if (flags.dryRun) {
    io.log('Dry run — no files written.');
    return 0;
  }
  if (!flags.yes && io.isTTY) {
    const ok = await prompts.confirm(planText);
    if (!ok) {
      io.log('Cancelled.');
      return 0;
    }
  }

  // 5. Write.
  let hadFailure = false;
  let viteWasWritten = false;
  for (const r of rows) {
    if (r.status === 'exists') {
      io.log(`= ${r.label}: already configured (${r.path}) — use --force to overwrite.`);
      continue;
    }
    if (r.status === 'manual') {
      io.log(`! ${r.label}: couldn't safely modify ${r.path} — add this by hand:\n${indent(r.snippet ?? '')}`);
      continue;
    }
    try {
      io.writeFile(r.path, r.content ?? '');
      io.log(`✓ ${r.label}: ${r.status} ${r.path}`);
      if (r.id === 'vite-plugin' || r.id === 'vite-dev-overlay') viteWasWritten = true;
    } catch (err) {
      hadFailure = true;
      io.errorLog(`svelte-vitals: failed to write ${r.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (hadFailure) return 2;

  // 6. Auto-install @svelte-vitals/vite if a Vite target was actually written.
  if (viteWasWritten && io.runCommand && !hasVitePackage(io)) {
    const pm = detectPackageManager(io);
    const { command, args } = installCommand(pm);
    io.log(`Installing @svelte-vitals/vite via ${pm}...`);
    const code = io.runCommand(command, args, io.cwd);
    if (code !== 0) {
      io.errorLog(
        `svelte-vitals: failed to install @svelte-vitals/vite (${command} ${args.join(' ')} exited ${code}). Install it manually.`
      );
    }
  }

  io.log('');
  if (clients.length > 0) io.log('Restart your client to load the svelte-vitals MCP server.');
  if (viteWasWritten) io.log('Restart `vite dev` (or your build) to pick up the change.');
  io.log('Done.');
  return 0;
}
```

- [ ] **Step 6: Run all install tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/install`
Expected: PASS — all pre-existing tests in `args.test.ts`, `cli.test.ts`, `clients.test.ts`, `merge.test.ts`, and every test in `run.test.ts` (old and new), plus Tasks 1–4's suites.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter svelte-vitals typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/install/clients.ts packages/cli/src/install/index.ts packages/cli/test/install/run.test.ts
git commit -m "feat(cli): wire Vite plugin targets into the install wizard"
```

---

## Task 6: `--client` accepts the new target ids

**Files:**

- Modify: `packages/cli/src/install/args.ts`
- Test: `packages/cli/test/install/args.test.ts` (new cases appended; existing cases must keep passing unchanged)

**Interfaces:**

- Consumes: `TargetId` (Task 5), `VITE_TARGETS` (Task 1).
- Produces: `resolveInstallArgs` now accepts and validates `vite-plugin` / `vite-dev-overlay` in `--client`.

- [ ] **Step 1: Write the failing tests (append to `args.test.ts`)**

Append using the file's existing local `parse(args: string[])` helper (already defined at the top of this file — do not redefine it):

```ts
describe('resolveInstallArgs — Vite targets', () => {
  it('accepts vite-plugin and vite-dev-overlay in --client', () => {
    const r = resolveInstallArgs(parse(['--client', 'vite-plugin,vite-dev-overlay']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['vite-plugin', 'vite-dev-overlay']);
  });
  it('mixes an MCP client id with a Vite target id', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,vite-plugin']));
    expect(r.errors).toEqual([]);
    expect(r.flags!.client).toEqual(['claude-code', 'vite-plugin']);
  });
  it('still rejects a genuinely unknown id', () => {
    const r = resolveInstallArgs(parse(['--client', 'not-a-real-target']));
    expect(r.warnings.join('\n')).toContain('not-a-real-target');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/args.test.ts`
Expected: FAIL — `vite-plugin`/`vite-dev-overlay` currently produce an "unknown --client" warning and are dropped.

- [ ] **Step 3: Update the implementation**

In `packages/cli/src/install/args.ts`, change:

```ts
import { CLIENTS, type ClientId, type Scope } from './clients.js';
import type { InstallFlags } from './index.js';

const VALID_CLIENTS: readonly ClientId[] = CLIENTS.map((c) => c.id);
```

to:

```ts
import { CLIENTS, type Scope } from './clients.js';
import { VITE_TARGETS } from './vite-targets.js';
import type { InstallFlags, TargetId } from './index.js';

const VALID_TARGETS: readonly TargetId[] = [...CLIENTS.map((c) => c.id), ...VITE_TARGETS.map((t) => t.id)];
```

Then, further down, change every remaining use of `VALID_CLIENTS` to `VALID_TARGETS`, and every `ClientId` annotation for the parsed list to `TargetId`:

```ts
const client: TargetId[] = [];
for (const c of rawClients) {
  if ((VALID_TARGETS as readonly string[]).includes(c)) {
    if (!client.includes(c as TargetId)) client.push(c as TargetId);
  } else {
    warnings.push(
      `svelte-vitals: unknown --client '${c}'; expected claude-code|cursor|codex|vite-plugin|vite-dev-overlay. Skipping.`
    );
  }
}
if (rawClients.length > 0 && client.length === 0) {
  errors.push(
    'svelte-vitals: no valid --client values; expected claude-code|cursor|codex|vite-plugin|vite-dev-overlay.'
  );
}
```

(These are the only two string-literal messages that need the expanded id list; the rest of the file — `scope` parsing, `yes`/`dry-run`/`force` flags, the returned `flags` object — is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/args.test.ts`
Expected: PASS — all pre-existing cases plus the three new ones.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter svelte-vitals typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/install/args.ts packages/cli/test/install/args.test.ts
git commit -m "feat(cli): accept vite-plugin and vite-dev-overlay in --client"
```

---

## Task 7: Interactive prompts, real `runCommand`, help text, and docs

**Files:**

- Modify: `packages/cli/src/install/cli.ts`
- Modify: `docs/src/content/docs/guides/cli.md`
- Modify: `docs/src/content/docs/ja/guides/cli.md`
- Test: manual verification only (`cli.ts`'s prompt-wiring and `realIO` are already covered indirectly by `cli.test.ts`'s `realIO` tests and by Tasks 5–6's `runInstall`/`args` tests, which exercise everything except the actual `@clack/prompts` rendering and the real `child_process.spawnSync` call — both are thin, side-effecting wrappers not worth mocking further)

- [ ] **Step 1: Update `clackPrompts()` and `INSTALL_HELP`**

In `packages/cli/src/install/cli.ts`, change the import line:

```ts
import type { ClientId, ClientWriter, Scope } from './clients.js';
```

to:

```ts
import type { ClientWriter, Scope } from './clients.js';
import type { SelectableOption, TargetId } from './index.js';
```

Change `selectClients` inside `clackPrompts()`:

```ts
    selectClients: async (all: ClientWriter[], defaults: ClientId[]) => {
      const res = await p.multiselect({
        message: 'Which clients should svelte-vitals be installed for?',
        options: all.map((c) => ({ value: c.id, label: c.label })),
        initialValues: defaults,
        required: true
      });
      return p.isCancel(res) ? null : (res as ClientId[]);
    },
```

to:

```ts
    selectClients: async (all: SelectableOption[], defaults: TargetId[]) => {
      const res = await p.multiselect({
        message: 'Which clients/targets should svelte-vitals be installed for?',
        options: all.map((o) => ({ value: o.id, label: o.label, hint: o.hint })),
        initialValues: defaults,
        required: true
      });
      return p.isCancel(res) ? null : (res as TargetId[]);
    },
```

Update `INSTALL_HELP`'s `--client` line:

```
  --client <ids>    Comma-separated: claude-code,cursor,codex (skips the interactive picker)
```

to:

```
  --client <ids>    Comma-separated: claude-code,cursor,codex,vite-plugin,vite-dev-overlay (skips the interactive picker)
```

Add one line right below it documenting the two new ids:

```
                    vite-plugin registers the build-mode plugin in vite.config; vite-dev-overlay
                    wires up the dev-overlay hook in src/hooks.server.ts. --force does not apply
                    to either — an existing registration is always left as-is.
```

- [ ] **Step 2: Add `runCommand` to `realIO()`**

Add the import at the top of `cli.ts`:

```ts
import { spawnSync } from 'node:child_process';
```

In the `realIO()` object, add:

```ts
runCommand: (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status ?? 1;
};
```

(as a new property alongside `readFile`/`writeFile`/etc.)

- [ ] **Step 3: Run the full CLI test suite**

Run: `pnpm --filter svelte-vitals exec vitest run`
Expected: PASS — every test in `packages/cli/test`, including `test/install/cli.test.ts`'s existing `realIO()` tests (unaffected — they only test `readFile`).

- [ ] **Step 4: Typecheck and build**

Run: `pnpm --filter svelte-vitals typecheck && pnpm --filter svelte-vitals build`
Expected: no errors; `dist/bin.js` is regenerated.

- [ ] **Step 5: Update the CLI guide docs**

In `docs/src/content/docs/guides/cli.md`, under the existing `### --client <ids>` section (part of `## svelte-vitals install`), replace:

```
Comma-separated clients to configure: `claude-code`, `cursor`, `codex`. When given, the interactive picker is skipped.
```

with:

```
Comma-separated clients/targets to configure: `claude-code`, `cursor`, `codex`, `vite-plugin`, `vite-dev-overlay`. When given, the interactive picker is skipped.

`vite-plugin` registers `@svelte-vitals/vite`'s build-mode plugin in `vite.config.{ts,js,mjs}`; `vite-dev-overlay` wires up the dev-overlay hook in `src/hooks.server.{ts,js}`. Both use a `magicast` codemod that only touches a file whose shape it confidently recognizes — anything else is left alone and a snippet is printed instead. If either is written and `@svelte-vitals/vite` isn't already a dependency, it's installed automatically via the detected package manager. **`--force` does not apply to these two** — an existing registration is always left as-is regardless of the flag.
```

Also update the `--scope` section's note if it currently implies scope applies to all clients — add a short clause: "(Vite targets have no scope and ignore this flag.)"

- [ ] **Step 6: Update the Japanese CLI guide**

Apply the equivalent translation to `docs/src/content/docs/ja/guides/cli.md`'s corresponding `--client` section, matching the terminology already used in `docs/src/content/docs/ja/guides/choosing-a-package.md` (「Vite プラグイン」「開発オーバーレイ」「ビルドゲート」).

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/install/cli.ts docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md
git commit -m "feat(cli): surface Vite install targets in the wizard UI, help text, and docs"
```

---

## Final check (run once, after Task 7)

- [ ] Run the whole workspace test suite: `pnpm test`
- [ ] Run the whole workspace typecheck: `pnpm typecheck`
- [ ] Run lint: `pnpm lint`
- [ ] Manually smoke-test the wizard end to end in a scratch SvelteKit-shaped directory (a `vite.config.ts` with a `plugins: [sveltekit()]` array and no `src/hooks.server.ts`): run `node packages/cli/dist/bin.js install --client vite-plugin,vite-dev-overlay --dry-run` from that directory and confirm the printed plan matches expectations, then re-run without `--dry-run --yes` and confirm the two files are written correctly and (if no `@svelte-vitals/vite` dependency is present) an install command is attempted.
