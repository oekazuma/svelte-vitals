# End-user Node floor smoke — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the development toolchain from being held to the published packages' `engines.node` floor, by moving the floor claim off the vitest suite and onto a bare-`node` smoke of the built `dist`.

**Architecture:** The `test` matrix stops pinning the floor version and tracks the release lines the dev toolchain supports (`22`, `24.16.0`, `26`). A new `floor-smoke` CI job pins 22.13.0 and runs `scripts/floor-smoke.mjs` — plain ESM with `node:assert`, no test runner — against the built `dist`. One vitest test whose only reason to exist was the floor is deleted, because the smoke covers it better.

**Tech Stack:** Node ESM (`.mjs`), `node:assert`, `node:child_process`; GitHub Actions; pnpm 11 workspaces; oxlint + oxfmt.

**Design doc:** `docs/superpowers/specs/2026-07-31-floor-smoke-design.md`

## Global Constraints

- The published packages' floor is `engines.node: >=22.13.0` on all four packages. Do not change it. It is settled (`2026-07-05-config-file-design.md`: "This floor is final").
- `scripts/floor-smoke.mjs` must not import vitest or any dev dependency. Node builtins only. Importing a test runner recreates the coupling this plan removes.
- The smoke asserts against the built `dist`, never `src`.
- Run `pnpm exec oxfmt --write <file>` on every file you touch before committing; `pnpm lint` gates CI.
- Conventional commits, scoped by package: `ci:`, `test(cli):`, `docs:`.
- This is CI + tooling only — no published-package code changes, so **no changeset**.
- Node facts used throughout: native TypeScript type-stripping is unflagged from **22.18** / **23.6**; on the floor (22.13–22.17) a `.ts` config needs `--experimental-strip-types`. jsdom 30 requires `^22.22.2 || ^24.15.0 || >=26.0.0`.

---

### Task 1: The smoke script and its CLI-contract checks

**Files:**
- Create: `scripts/floor-smoke.mjs`
- Modify: `package.json` (root `scripts` block)

**Interfaces:**
- Consumes: the built `dist` of all four packages (`pnpm build` output) and `packages/cli/test/fixtures/basic-project`.
- Produces: `node scripts/floor-smoke.mjs` — exits 0 when every check passes, 1 otherwise, printing one `ok`/`FAIL` line per check. Task 2 appends a check to the same `check(name, fn)` registry. Task 3 invokes it from CI.

- [ ] **Step 1: Build the packages so the smoke has something to run**

```bash
pnpm build
```

Expected: exits 0; `packages/cli/dist/bin.js`, `packages/core/dist/index.js`, `packages/vite/dist/index.js`, `packages/vite/dist/hooks/index.js`, and `packages/mcp/dist/index.js` all exist.

- [ ] **Step 2: Create `scripts/floor-smoke.mjs` with the four CLI-contract checks**

The style to match is the existing `scripts/verify-svelte-import.js` — a plain script that verifies, under a bare runtime, the part whose behaviour is runtime-dependent.

```js
// End-user Node floor smoke (design doc:
// docs/superpowers/specs/2026-07-31-floor-smoke-design.md).
//
// Runs the BUILT `dist` of the published packages under a bare `node` — never
// through vitest. CI pins this to the `engines.node` floor (22.13.0), which is
// the version no dev dependency is held to any more; `pnpm test` covers the
// release lines the dev toolchain supports instead.
//
//   node scripts/floor-smoke.mjs
//
// Assertions are hand-rolled against `node:assert`: pulling in a test runner
// would put the dev toolchain back on the floor, which is the whole point.

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cliBin = join(root, 'packages/cli/dist/bin.js');
const basicProject = join(root, 'packages/cli/test/fixtures/basic-project');

/** Run the built CLI. Never throws: returns the exit code alongside the captured streams. */
function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cliBin, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      ...opts
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status ?? 1, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') };
  }
}

const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

check('--version prints the CLI and core versions and exits 0', () => {
  const { code, stdout } = runCli(['--version']);
  assert.equal(code, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+ \(core \d+\.\d+\.\d+\)$/);
});

check('a directory that is not a SvelteKit project exits 2', () => {
  const empty = mkdtempSync(join(tmpdir(), 'floor-smoke-empty-'));
  const { code, stderr } = runCli([empty]);
  assert.equal(code, 2);
  assert.match(stderr, /No SvelteKit project found/);
});

check('analysing a real project emits a well-formed JSON report', () => {
  const { code, stdout } = runCli([basicProject, '--reporter', 'json']);
  // 0 (clean) and 1 (a finding reached the fail threshold) are both contractual;
  // asserting the score would make this smoke a hostage of the rule set.
  assert.ok(code === 0 || code === 1, `expected exit 0 or 1, got ${code}`);
  const report = JSON.parse(stdout);
  assert.equal(typeof report.version, 'string');
  assert.equal(typeof report.score, 'number');
  assert.ok(report.categories && typeof report.categories === 'object');
});

check('every published entry point imports under bare node', async () => {
  for (const entry of [
    'packages/core/dist/index.js',
    'packages/cli/dist/index.js',
    'packages/vite/dist/index.js',
    'packages/vite/dist/hooks/index.js',
    'packages/mcp/dist/index.js'
  ]) {
    const mod = await import(join(root, entry));
    assert.ok(Object.keys(mod).length > 0, `${entry} exported nothing`);
  }
});

console.log(`floor-smoke: node ${process.versions.node}`);

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`floor-smoke: ${failed} of ${checks.length} checks failed`);
  process.exit(1);
}
console.log(`floor-smoke: ${checks.length} checks passed`);
```

- [ ] **Step 3: Run it**

```bash
node scripts/floor-smoke.mjs
```

Expected: exit 0, and

```
floor-smoke: node 24.16.0
  ok   --version prints the CLI and core versions and exits 0
  ok   a directory that is not a SvelteKit project exits 2
  ok   analysing a real project emits a well-formed JSON report
  ok   every published entry point imports under bare node
floor-smoke: 4 checks passed
```

- [ ] **Step 4: Prove the checks can fail**

These checks describe behaviour that already works, so passing on the first run proves nothing. Temporarily change the first check's `assert.equal(code, 0);` to `assert.equal(code, 9);` and re-run:

```bash
node scripts/floor-smoke.mjs; echo "EXIT=$?"
```

Expected: `EXIT=1` and a line beginning `  FAIL   --version prints the CLI and core versions`. Revert the edit and re-run to confirm it is back to 4 passing checks. Do not commit the temporary edit.

- [ ] **Step 5: Add the `smoke` script to the root `package.json`**

Insert after the `"test"` line in the root `scripts` block, so it reads:

```json
    "test": "pnpm -r test",
    "smoke": "node scripts/floor-smoke.mjs",
    "bench": "pnpm --filter svelte-vitals... build && pnpm --filter @svelte-vitals/vite run bench",
```

- [ ] **Step 6: Verify the script entry and formatting**

```bash
pnpm smoke && pnpm exec oxfmt --write scripts/floor-smoke.mjs package.json && pnpm lint
```

Expected: the smoke prints 4 passing checks, then `pnpm lint` exits 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/floor-smoke.mjs package.json
git commit -m "ci: add a bare-node smoke of the built dist for the engines.node floor"
```

---

### Task 2: Assert the `.ts` config contract, which vitest cannot reach

**Files:**
- Modify: `scripts/floor-smoke.mjs`

**Interfaces:**
- Consumes: `check(name, fn)` and `runCli(args)` from Task 1; the fixture `packages/cli/test/fixtures/config-file-ts/svelte-vitals.config.ts`.
- Produces: a fifth check. Task 4 deletes the vitest test this supersedes.

Background the implementer needs: `loadConfigFile` (`packages/cli/src/config-file.ts:263-271`) catches Node's `ERR_UNKNOWN_FILE_EXTENSION` for a `.ts` config and rethrows an actionable message. That branch is only reachable on Node 22.13–22.17, and **no vitest test can ever reach it** — vitest's module runner transforms in-process dynamic `import()`, so a `.ts` config always loads inside vitest regardless of the host Node. A bare-`node` smoke on the floor is the only way to cover it.

- [ ] **Step 1: Widen the imports this check needs**

The check copies a fixture, so `cpSync` joins the `node:fs` import and the fixtures directory gets its own constant:

```js
import { cpSync, mkdtempSync } from 'node:fs';
```

```js
const fixtures = join(root, 'packages/cli/test/fixtures');
const basicProject = join(fixtures, 'basic-project');
```

- [ ] **Step 2: Add the check**

Insert after the `'every published entry point imports under bare node'` check, and add the `supportsUnflaggedTypeStripping` helper directly above the first `check(...)` call:

```js
/**
 * Whether this Node strips TypeScript types from `import()` without a flag:
 * unflagged in 23.6.0, backported to 22.18.0. The floor (22.13.0) is inside the
 * window that needs `--experimental-strip-types`, so this decides which side of
 * the `.ts` config contract to assert.
 */
function supportsUnflaggedTypeStripping() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  return (major === 22 && minor >= 18) || (major === 23 && minor >= 6) || major >= 24;
}
```

```js
check("a .ts config file matches this Node runtime's type-stripping support", () => {
  // The CLI resolves the project before it loads the config, so the `.ts` config
  // needs to sit in something that looks like a SvelteKit app.
  const project = mkdtempSync(join(tmpdir(), 'floor-smoke-ts-'));
  cpSync(basicProject, project, { recursive: true });
  cpSync(join(fixtures, 'config-file-ts/svelte-vitals.config.ts'), join(project, 'svelte-vitals.config.ts'));

  const { code, stderr } = runCli([project, '--reporter', 'json']);
  if (supportsUnflaggedTypeStripping()) {
    assert.ok(code === 0 || code === 1, `expected the .ts config to load, got exit ${code}: ${stderr}`);
  } else {
    // The floor's contract: loadConfigFile turns Node's raw
    // ERR_UNKNOWN_FILE_EXTENSION into an actionable message. vitest can never
    // reach this branch — its module runner transforms in-process `import()`.
    assert.equal(code, 2);
    assert.match(stderr, /does not support TypeScript config files without a flag/);
    assert.match(stderr, /22\.18\+/);
  }
});
```

Also extend the banner so the log records which side ran:

```js
console.log(
  `floor-smoke: node ${process.versions.node} (unflagged type stripping: ${supportsUnflaggedTypeStripping()})`
);
```

- [ ] **Step 3: Run it**

```bash
pnpm smoke
```

Expected: exit 0, `floor-smoke: 5 checks passed`, and the banner ends with `(unflagged type stripping: true)` on a modern dev Node.

- [ ] **Step 4: Prove the new check can fail**

Temporarily change `assert.ok(code === 0 || code === 1, ...)` in the new check to `assert.equal(code, 2);` and re-run:

```bash
pnpm smoke; echo "EXIT=$?"
```

Expected: `EXIT=1` with `FAIL   a .ts config file matches this Node runtime's type-stripping support`. Revert and re-run to confirm 5 passing checks. Do not commit the temporary edit.

- [ ] **Step 5: Format, lint, commit**

```bash
pnpm exec oxfmt --write scripts/floor-smoke.mjs && pnpm lint && pnpm smoke
git add scripts/floor-smoke.mjs
git commit -m "ci: assert the .ts config contract that vitest cannot reach"
```

---

### Task 3: Split the CI jobs

**Files:**
- Modify: `.github/workflows/ci.yml` (the `test` job's matrix comment and `node-version`; new `floor-smoke` job after `test`)

**Interfaces:**
- Consumes: `node scripts/floor-smoke.mjs` from Tasks 1–2; the existing `./.github/workflows/setup-node` composite action, whose `node-version` input rewrites `devEngines.runtime.version` so pnpm's managed runtime actually runs under that version.
- Produces: a `floor-smoke` CI job, and a `test` matrix that no longer pins the published floor.

- [ ] **Step 1: Retarget the `test` matrix**

Replace the matrix block (currently `node-version: ['22.13.0', '24.16.0', '26']` with the comment above it) with:

```yaml
      matrix:
        # setup-node rewrites devEngines.runtime.version to this,
        # so pnpm's managed runtime (onFail: download) actually runs scripts under it.
        # These are the release lines the DEV toolchain supports — NOT the published
        # engines.node floor, which the `floor-smoke` job defends on 22.13.0 instead.
        # Pinning the floor here would hold every dev dependency to it: jsdom 30
        # already requires ^22.22.2, and vite/oxlint sit 0.01 above 22.13.0.
        # '22' is the latest 22.x (maintenance LTS until 2027-04);
        # 24.16.0 is the current release used for development (devEngines);
        # '26' is the latest of the Current line (active LTS from 2026-10) — early warning.
        node-version: ['22', '24.16.0', '26']
```

- [ ] **Step 2: Add the `floor-smoke` job**

Insert between the `test` job and the `docs` job:

```yaml
  floor-smoke:
    needs: check
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      # 22.13.0 is the published packages' engines.node floor. This is the only job
      # pinned to it: it runs the built dist under a bare `node`, so no dev
      # dependency (jsdom, vitest, ...) is held to the end-user's Node version.
      - name: Setup Node.js and dependencies
        uses: ./.github/workflows/setup-node
        with:
          node-version: '22.13.0'
      - name: Restore package builds
        id: dist-cache
        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: packages/*/dist
          key: dist-${{ hashFiles('packages/*/src/**', 'pnpm-lock.yaml', 'packages/*/tsup.config.ts') }}
      # Fallback only: `needs: check` populates this exact cache key, so a miss means
      # eviction. Building here would run tsup on the floor Node.
      - name: Build packages
        if: steps.dist-cache.outputs.cache-hit != 'true'
        run: pnpm build
      - name: Run the end-user floor smoke
        run: node scripts/floor-smoke.mjs
```

Note the last step calls `node` directly, not `pnpm smoke`: `actions/setup-node` puts 22.13.0 on `PATH`, and going through pnpm would route the script into pnpm's managed runtime instead.

- [ ] **Step 3: Verify the workflow parses**

```bash
pnpm exec oxfmt --check .github/workflows/ci.yml || true
node -e "import('node:fs').then(({readFileSync})=>{const t=readFileSync('.github/workflows/ci.yml','utf8');for (const j of ['  lint:','  check:','  test:','  floor-smoke:','  docs:']) if(!t.includes(j)) throw new Error('missing job '+j); if(t.includes(\"'22.13.0', '24.16.0'\")) throw new Error('test matrix still pins the floor'); console.log('ci.yml jobs ok')})"
```

Expected: `ci.yml jobs ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: defend the engines.node floor with a smoke job, not the test matrix"
```

---

### Task 4: Delete the superseded vitest test and record the two floors

**Files:**
- Modify: `packages/cli/test/config-file.test.ts` (delete the child-process `.ts` test, its helper, and the now-unused imports)
- Modify: `AGENTS.md` (verify-commands table + a new subsection under "Hard rules")

**Interfaces:**
- Consumes: the check added in Task 2, which supersedes the deleted test.
- Produces: nothing other tasks depend on. This is the last task.

Why the test goes rather than gets edited: it asserts **Node's own** behaviour (a bare `import()` of a `.ts` file yields `ERR_UNKNOWN_FILE_EXTENSION` on old Node), branching so that it passes on either side without ever asserting which side it is on. The smoke's check asserts **the CLI's** guided error on the floor side, which is the actual end-user contract. Keeping both would leave a test whose old-Node branch no CI job executes.

- [ ] **Step 1: Confirm nothing else uses the pieces you are deleting**

```bash
grep -rn "execFileSync\|pathToFileURL\|nodeSupportsUnflaggedTypeStripping" packages/cli/test/config-file.test.ts
grep -rn "config-file-ts" --include="*.ts" --include="*.mjs" --include="*.md" . --exclude-dir=node_modules
```

Expected: the first prints only lines 1, 3, 21, 265, 279, 288 (all inside the test being deleted). The second prints only `scripts/floor-smoke.mjs` and this plan — the fixture stays, because the smoke now uses it.

- [ ] **Step 2: Delete the test, the helper, and the unused imports**

Delete these, and nothing else:
1. Line 1 — `import { execFileSync } from 'node:child_process';`
2. Line 3 — `import { pathToFileURL } from 'node:url';`
3. The `nodeSupportsUnflaggedTypeStripping` function and its doc comment (the block starting `/**\n * Whether this Node runtime strips TypeScript types` through the closing `}`)
4. The final `it(...)` in the file — the one titled `native import() of a .ts config succeeds on Node 22.18+/23.6+, else fails with ERR_UNKNOWN_FILE_EXTENSION (child process)` — together with the two comment lines above it beginning `// Spike finding: this MUST run in a child process.`

In their place, leave a pointer as the last line inside the `describe` block:

```ts
  // The `.ts`-config contract on old Node (22.13–22.17 needs
  // --experimental-strip-types) is asserted in scripts/floor-smoke.mjs, under a
  // bare `node`. It cannot live here: vitest's module runner transforms
  // in-process dynamic `import()`, so a `.ts` config always loads inside vitest
  // regardless of the host Node.
```

- [ ] **Step 3: Run the CLI test suite**

```bash
pnpm --filter svelte-vitals test
```

Expected: all tests pass, with the `loadConfigFile` describe block one test lighter and no unused-import lint error.

- [ ] **Step 4: Record the two floors in AGENTS.md**

In the verify-commands table, add a row after `Test`:

```markdown
| Floor smoke    | `pnpm smoke`         | built `dist` under a bare `node`      |
```

Then add this subsection to "Hard rules", after the "Core purity" bullet:

```markdown
- **Two Node floors, two jobs**: the published packages promise
  `engines.node: >=22.13.0` (end users); the dev toolchain is pinned by
  `devEngines.runtime` and is free to require more. CI keeps these apart —
  `test` runs the vitest suite on the release lines the toolchain supports
  (`22` / `24.16.0` / `26`), and `floor-smoke` runs the built `dist` under a bare
  `node` on 22.13.0 (`scripts/floor-smoke.mjs`). So a dev dependency raising its
  Node floor is not a problem: jsdom 30 requires `^22.22.2` and that is fine.
  Never pin the `test` matrix back to 22.13.0, and never add a dev dependency to
  the smoke — it must stay Node-builtins-only. Design doc:
  `docs/superpowers/specs/2026-07-31-floor-smoke-design.md`.
```

- [ ] **Step 5: Full verification**

```bash
pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm smoke
```

Expected: every command exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/test/config-file.test.ts AGENTS.md
git commit -m "test(cli): move the .ts-config floor contract to the bare-node smoke"
```

---

## Done when

- `pnpm smoke` passes locally (5 checks).
- CI shows a `floor-smoke` job green on 22.13.0 and `test` green on `22` / `24.16.0` / `26`.
- `packages/cli/test/config-file.test.ts` no longer branches on `process.versions.node`.
- AGENTS.md states which job defends which floor.

## Follow-up, explicitly out of scope

Renovate PR #332 (jsdom 29 → 30) can merge before or after this work; it is not blocked by it. The floor mismatch predates jsdom 30 — jsdom 30 is only the first dev dependency to make it visible.
