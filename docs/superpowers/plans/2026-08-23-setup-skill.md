# setup-svelte-vitals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a third agent skill, `setup-svelte-vitals`, that derives a project's `svelte-vitals.config` from its existing markuplint / eslint-plugin-check-file config and its actual directory tree — plus the `--config <path>` flag the skill needs to measure a candidate before writing it.

**Architecture:** Two stages. Stage A (Tasks 1–3) adds `--config <path>`: the config loader gains a by-path entry point, the flag threads through the existing `AnalyzeOptions.loadedConfig` slot, and an e2e case pins its observable effect. Stage B (Tasks 4–6) adds the skill: a new generator emits a machine-derived reference of every configurable rule plus a handwritten workflow and mapping tables, wired into the existing `gen:skills` pipeline and its drift test.

**Tech Stack:** TypeScript (ESM, Node >= 24.16.0), vitest, pnpm workspaces, gunshi (CLI arg layer), tsdown (build), oxlint + oxfmt.

**Design doc:** `docs/superpowers/specs/2026-08-23-setup-skill-design.md`. Read it before Task 4 — Tasks 4–5 transcribe its tables and workflow, and the wording there is the decision.

## Global Constraints

- **Core purity:** never add a `node:` import or direct I/O inside `packages/core`. All work in this plan lives in `packages/cli`, `examples/kitchen-sink`, `docs/` and `skills/`.
- **`skills/` is generated, never hand-edited.** Edit the generator, then run `pnpm --filter svelte-vitals run gen:skills`. oxfmt ignores `skills/`, so the files stay byte-identical to generator output.
- **`packages/cli/src/docs/generated.ts` is generated.** Edit `packages/cli/docs/*.md`, then `pnpm --filter svelte-vitals run gen:docs && pnpm format`.
- **The CLI flag-reference tables in the docs site are generated.** After changing any flag, run `pnpm --filter svelte-vitals run gen:cli-reference && pnpm format`. Never edit between the `<!-- cli-reference:start/end -->` markers by hand.
- **en/ja docs stay in sync.** After editing an English page under `docs/src/content/docs/`, update the Japanese twin under `docs/src/content/docs/ja/`, then `pnpm --filter docs run translate:stamp <en-file>`.
- **Never hard-code rule counts or ID ranges** in READMEs or guides.
- **oxfmt formats markdown too**, and it will join a two-line example inside a ` ```svelte ` fence. Use ` ```html ` for a markup example whose point is that one line sits above another.
- **Order of operations when both a doc and a generator change:** edit source → `pnpm format` → regenerate → `pnpm format`. Regenerating before formatting bakes unformatted text into the generated file and the drift test fails.
- **Verify commands:** `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm check:publish`, `pnpm smoke`. `pnpm test` builds first.
- **Never pipe a verify command into `head`/`tail` and then `&&`** — the exit code becomes the pipe's, and a failure reads as success. Use `set -o pipefail` or capture the status directly.
- **Never run `npm` or `npx` in this repo.** `devEngines.runtime` pins Node 24.16.0 and every npm invocation fails `EBADDEVENGINES`. Use `pnpm exec`.

---

## File Structure

| File                                                       | Responsibility                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/config-file.ts` (modify)                 | gains `loadConfigFromPath(path)` — the same loader and validation as discovery, entered by path                 |
| `packages/cli/src/index.ts` (modify)                       | `AnalyzeOptions.configPath` / `RunOptions.configPath`; `analyzeProject` picks the by-path loader over discovery |
| `packages/cli/src/resolve-args.ts` (modify)                | `config` joins the string/value flag tables and lands on `RunOptions.configPath`                                |
| `packages/cli/src/gunshi/analyze.ts` (modify)              | `config` joins `ROOT_ARGS` — this is what the help text, completion and generated flag tables read              |
| `packages/cli/src/install/setup-skill-content.ts` (create) | the third skill's generator: machine-derived configurable-rule reference + handwritten body                     |
| `packages/cli/scripts/gen-skills.js` (modify)              | emits the third skill                                                                                           |
| `packages/cli/test/skills-repo.test.ts` (modify)           | drift-guards the third skill                                                                                    |
| `packages/cli/test/setup-skill.test.ts` (create)           | guards the mapping tables against renamed rules and options                                                     |

---

### Task 1: `loadConfigFromPath` — load a config the caller named

**Files:**

- Modify: `packages/cli/src/config-file.ts:246-262` (`loadConfigFile`)
- Test: `packages/cli/test/config-file.test.ts`

**Interfaces:**

- Consumes: `LoadedConfigFile` (already exported from the same file).
- Produces: `export async function loadConfigFromPath(path: string): Promise<LoadedConfigFile>` — resolves to the loaded+validated config, or throws. Never returns `undefined`: the caller named a file, so an absent one is an error, unlike discovery where absence means "no config".

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/test/config-file.test.ts`:

```ts
describe('loadConfigFromPath', () => {
  it('loads a config the caller named, ignoring cwd discovery', async () => {
    const loaded = await loadConfigFromPath(join(fixture('config-file-js'), 'svelte-vitals.config.js'));
    expect(loaded.config).toEqual({
      treatDynamicAs: 'warn',
      failOn: 'warning',
      rules: { 'seo/title-presence': 'off' }
    });
  });

  it('rejects an extension the loader does not support, before touching the disk', async () => {
    // .mjs was retired with a loud tripwire in discovery; a by-path loader that just
    // import()s would resurrect it silently.
    await expect(loadConfigFromPath('/nowhere/svelte-vitals.config.mjs')).rejects.toThrow(/\.js and \.ts only/);
  });

  it('treats a missing named file as fatal', async () => {
    await expect(loadConfigFromPath(join(fixture('config-file-none'), 'svelte-vitals.config.js'))).rejects.toThrow(
      /does not exist/
    );
  });
});
```

Add `loadConfigFromPath` to the existing import at the top of the file:

```ts
import { loadConfigFile, loadConfigFromPath } from '../src/config-file.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/config-file.test.ts`
Expected: FAIL — `loadConfigFromPath is not a function` (or a TypeScript error on the import).

- [ ] **Step 3: Extract the loader half and add the by-path entry point**

In `packages/cli/src/config-file.ts`, leave `loadConfigFile`'s discovery half as it is and delegate its tail. Replace the body from `let mod: { default?: unknown };` onward with a call, and add the two functions:

```ts
export async function loadConfigFile(cwd: string): Promise<LoadedConfigFile | undefined> {
  const found = CONFIG_FILENAMES.map((name) => join(cwd, name)).find((path) => existsSync(path));
  if (!found) {
    // Migration tripwire: `.mjs` was the default scaffold extension before the loader
    // narrowed to {js,ts} — running with silent defaults would un-gate CI without a trace,
    // so a leftover .mjs fails loudly instead.
    const retired = join(cwd, 'svelte-vitals.config.mjs');
    if (existsSync(retired)) {
      throw new Error(
        `${retired} is no longer read — svelte-vitals loads svelte-vitals.config.{js,ts} only. ` +
          'Rename the file to .js (the project must be "type": "module") or .ts.'
      );
    }
    return undefined;
  }
  return loadFrom(found);
}

/**
 * Load and validate a config file the caller named (`--config`) instead of one discovered in
 * `cwd`. Same loader, same validation; the difference is what absence means — the caller chose
 * this file, so a missing one is fatal where a missing discovered file is simply "no config".
 * The extension is checked first, and before the disk is touched: discovery narrowed to
 * `{js,ts}` and kept a loud tripwire for `.mjs`, and a by-path loader that went straight to
 * `import()` would quietly accept the file that tripwire exists to reject.
 */
export async function loadConfigFromPath(path: string): Promise<LoadedConfigFile> {
  if (!/\.(js|ts)$/.test(path)) {
    throw new Error(`${path} is not a supported config file — svelte-vitals loads .js and .ts only.`);
  }
  if (!existsSync(path)) throw new Error(`${path} does not exist.`);
  return loadFrom(path);
}
```

Then move the existing import-and-validate tail — everything that was after the `found` check, starting at `let mod: { default?: unknown };` and ending with the current `return` — into a module-private function directly below, renaming the local `found` to `path`:

```ts
/** Import one known-present config file and validate it. Shared by discovery and `--config`. */
async function loadFrom(path: string): Promise<LoadedConfigFile> {
  // ... the existing body, with `found` renamed to `path`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/config-file.test.ts`
Expected: PASS, including every pre-existing `loadConfigFile` test — the discovery path must be unchanged.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter svelte-vitals typecheck
git add packages/cli/src/config-file.ts packages/cli/test/config-file.test.ts
git commit -m "feat(cli): load a config file by path, not only by discovery"
```

---

### Task 2: thread `--config` from argv to the analyzer

**Files:**

- Modify: `packages/cli/src/gunshi/analyze.ts` (the `ROOT_ARGS` object)
- Modify: `packages/cli/src/resolve-args.ts` (`VALUE_FLAGS`, `RUN_STRING_FLAGS`, `resolveArgs`)
- Modify: `packages/cli/src/index.ts` (`RunOptions`, `AnalyzeOptions`, `analyzeProject`, `runAnalyzeOptions`)
- Test: `packages/cli/test/run-config-path.test.ts` (create)

**Interfaces:**

- Consumes: `loadConfigFromPath` from Task 1.
- Produces: `RunOptions.configPath?: string` and `AnalyzeOptions.configPath?: string` — a cwd-relative or absolute path to a config file. When set, discovery is skipped. `loadedConfig` still wins over both, so the `--baseline` second analysis keeps reusing the first one's config.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/run-config-path.test.ts`:

```ts
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { analyzeProject } from '../src/index.js';
import { parseRunArgs, resolveArgs } from '../src/resolve-args.js';

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);

describe('--config <path>', () => {
  it('parses onto RunOptions.configPath', () => {
    const { options, errors } = resolveArgs(parseRunArgs(['--config', 'other.config.js']));
    expect(errors).toEqual([]);
    expect(options?.configPath).toBe('other.config.js');
  });

  it('rejects a bare --config like every other value flag', () => {
    const { errors } = resolveArgs(parseRunArgs(['--config']));
    expect(errors).toContain('svelte-vitals: --config requires a value.');
  });

  it('loads the named config instead of the one in the analyzed directory', async () => {
    // The fixture project's own config turns seo/title-presence off; the named one does not,
    // so the rule running again is proof discovery was skipped rather than merged.
    const withOwn = await analyzeProject({ cwd: fixture('config-file-js') });
    expect(withOwn.config.rules['seo/title-presence']).toBe('off');

    const withNamed = await analyzeProject({
      cwd: fixture('config-file-js'),
      configPath: join(fixture('config-file-named'), 'svelte-vitals.config.js')
    });
    expect(withNamed.config.rules['seo/title-presence']).toBeUndefined();
  });

  it('fails the run when the named config does not exist', async () => {
    await expect(analyzeProject({ cwd: fixture('config-file-js'), configPath: 'no-such.config.js' })).rejects.toThrow(
      /does not exist/
    );
  });
});
```

Create a new fixture directory for the config the third test names. It has to be a new one:
`config-file-none` is asserted by an existing test to contain no config file
(`config-file.test.ts:14`, `resolves.toBeUndefined()`), so dropping a config into it would break
that test.

`packages/cli/test/fixtures/config-file-named/svelte-vitals.config.js`:

```js
export default { treatDynamicAs: 'warn' };
```

`packages/cli/test/fixtures/config-file-named/package.json`, mirroring the sibling fixtures:

```json
{
  "name": "config-file-named-fixture",
  "type": "module",
  "private": true
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/run-config-path.test.ts`
Expected: FAIL — `configPath` is not a known property.

- [ ] **Step 3: Declare the flag**

In `packages/cli/src/gunshi/analyze.ts`, add to `ROOT_ARGS` immediately after the `rules` entry:

```ts
  config: {
    type: 'string',
    description: 'Path to a config file to use instead of the one in the analyzed directory'
  },
```

In `packages/cli/src/resolve-args.ts`, add `'config'` to both `VALUE_FLAGS` and `RUN_STRING_FLAGS` (after `'rules'` in each, to keep the two lists reading the same). `VALUE_FLAGS` membership is what produces the "requires a value" error the second test asserts — no extra code.

- [ ] **Step 4: Thread it to the analyzer**

In `packages/cli/src/index.ts`:

Add to `RunOptions`, beside the other analysis options:

```ts
  /** `--config`: load this config file instead of discovering one in the analyzed directory. */
  configPath?: string;
```

Add the same field with the same doc comment to `AnalyzeOptions`, directly above `loadedConfig`.

In `analyzeProject`, replace the config-loading line:

```ts
const loaded =
  opts.loadedConfig !== undefined
    ? (opts.loadedConfig ?? undefined)
    : opts.configPath !== undefined
      ? await loadConfigFromPath(resolve(opts.configPath))
      : await loadConfigFile(cwd);
```

Extend the existing import from `./config-file.js` to bring in `loadConfigFromPath`, and make sure `resolve` is imported from `node:path` (add it to the existing import if absent).

In `runAnalyzeOptions`, forward it:

```ts
    configPath: opts.configPath,
```

In `resolveArgs` (`packages/cli/src/resolve-args.ts`), add `configPath` to the returned `options` object alongside the other string flags:

```ts
    configPath: typeof argv.config === 'string' ? resolve(argv.config) : undefined,
```

Relative paths resolve against the shell's cwd (`process.cwd()`), never against the analyzed
directory — resolving in `resolveArgs` keeps the monorepo app-picker retry from re-basing the
path against the app it picks.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/run-config-path.test.ts test/config-file.test.ts test/run.test.ts test/gunshi-analyze.test.ts`
Expected: PASS. `gunshi-analyze.test.ts` exercises the arg table; if it snapshots the help output, update the snapshot in the same commit.

- [ ] **Step 6: Commit**

```bash
pnpm --filter svelte-vitals typecheck
git add packages/cli/src packages/cli/test
git commit -m "feat(cli): add --config to analyze against a config file by path"
```

---

### Task 3: guard `--config` with an e2e case, then document it

**Files:**

- Test: `examples/kitchen-sink/test/e2e-config-path.test.ts` (create)
- Modify: `packages/cli/docs/config.md`
- Modify: `docs/src/content/docs/guides/(setup)/configuration.mdx` and its ja twin
- Create: `.changeset/config-path-flag.md`
- Regenerate: `packages/cli/src/docs/generated.ts`, the cli-reference tables

**Interfaces:**

- Consumes: the `--config` flag from Task 2.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing e2e test**

`examples/kitchen-sink/test/e2e-config-path.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The gallery ships its own svelte-vitals.config.ts, so a --config run that changes the result
// proves both halves at once: the named file is loaded, and discovery is skipped rather than
// merged. Guard (1) of the two-guard rule for user-facing levers (AGENTS.md).
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(appDir, '..', '..', 'packages', 'cli', 'dist', 'bin.js');

interface JsonReport {
  rules: Record<string, { findings: number; passed: number }>;
}

function run(...args: string[]): JsonReport {
  const res = spawnSync(process.execPath, [bin, appDir, ...args, '--reporter', 'json'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  return JSON.parse(res.stdout) as JsonReport;
}

let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'sv-config-path-'));
  writeFileSync(
    join(scratch, 'svelte-vitals.config.js'),
    "export default { rules: { 'seo/title-presence': 'off' } };\n"
  );
});

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('--config <path>', () => {
  it('analyzes under the named config instead of the project’s own', () => {
    const discovered = run();
    expect(discovered.rules['seo/title-presence']!.findings).toBeGreaterThan(0);

    const named = run('--config', join(scratch, 'svelte-vitals.config.js'));
    expect(named.rules['seo/title-presence']).toBeUndefined();
  });

  it('exits 2 when the named config does not exist', () => {
    const res = spawnSync(process.execPath, [bin, appDir, '--config', join(scratch, 'absent.config.js')], {
      encoding: 'utf8'
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/does not exist/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then passes against the built CLI**

```bash
pnpm build
pnpm --filter kitchen-sink exec vitest run test/e2e-config-path.test.ts
```

Expected before Task 2's code is built: FAIL. After `pnpm build` with Task 2 in place: PASS. Run `pnpm --filter svelte-vitals exec vitest run test/flag-coverage.test.ts` too — it fails until some test names `--config`, and this one now does.

- [ ] **Step 3: Document the flag in the bundled guide**

In `packages/cli/docs/config.md`, add to the section that introduces where the config file lives:

```markdown
`--config <path>` analyzes under the config file at that path instead of the one in the analyzed
directory — no discovery, no merge. It accepts `.js` and `.ts` only, and a missing or unreadable
file exits `2`. Useful for trying a config out before committing it, and for sharing one config
across the apps in a monorepo.
```

Then regenerate and format, in this order:

```bash
pnpm format
pnpm --filter svelte-vitals run gen:docs
pnpm format
```

- [ ] **Step 4: Regenerate the flag-reference tables**

```bash
pnpm --filter svelte-vitals run gen:cli-reference
pnpm format
```

This rewrites the en and ja tables between the `<!-- cli-reference:start/end -->` markers from the `ROOT_ARGS` description added in Task 2. Do not hand-edit inside the markers.

- [ ] **Step 5: Update the docs-site configuration guide, en and ja**

Add the same paragraph as Step 3 (in prose form matching the surrounding page) to `docs/src/content/docs/guides/(setup)/configuration.mdx`, then write the Japanese equivalent into `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`, then stamp:

```bash
pnpm --filter docs run translate:stamp "src/content/docs/guides/(setup)/configuration.mdx"
pnpm --filter docs run translate:check
```

- [ ] **Step 6: Changeset**

`.changeset/config-path-flag.md`:

```markdown
---
'svelte-vitals': minor
---

Add `--config <path>`: analyze under the config file at that path instead of the one discovered in the analyzed directory. Discovery is skipped rather than merged, `.js` and `.ts` are the only accepted extensions, and a missing or unreadable file exits `2`.
```

- [ ] **Step 7: Full verify and commit**

```bash
set -o pipefail
pnpm lint && pnpm typecheck && pnpm test && pnpm check:publish && pnpm smoke
git add -A
git commit -m "test(cli): pin --config's effect on the gallery, and document the flag"
```

---

### Task 4: the generated half of the setup skill

**Files:**

- Create: `packages/cli/src/install/setup-skill-content.ts`
- Test: `packages/cli/test/setup-skill.test.ts` (create)

**Interfaces:**

- Consumes: `allRules`, `docsUrlFor` from `@svelte-vitals/core/internal`; `oneLine` from `./skill-content.js` (already exported there).
- Produces: `export function configurableRulesReference(): string` — the machine-derived section,
  and nothing else. `buildSetupSkillMarkdown` arrives whole in Task 5: a stub here would be a
  deliverable that only looks finished, and the task reviewer would be right to reject it.

- [ ] **Step 1: Write the failing test**

`packages/cli/test/setup-skill.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allRules } from '@svelte-vitals/core/internal';
import { configurableRulesReference } from '../src/install/setup-skill-content.js';

describe('configurableRulesReference', () => {
  const reference = configurableRulesReference();

  it('lists every rule that declares options, and no rule that does not', () => {
    for (const rule of allRules) {
      if (rule.options) expect(reference).toContain(rule.id);
      else expect(reference).not.toContain(`**${rule.id}**`);
    }
  });

  it('marks a rule inert when every one of its options defaults empty', () => {
    // architecture/directory-naming declares `directories` and `exclude`, both empty by default.
    expect(reference).toMatch(/architecture\/directory-naming[^\n]*inert/);
    // performance/heavy-import declares options with real defaults, so it is not inert.
    expect(reference).not.toMatch(/performance\/heavy-import[^\n]*inert/);
  });

  it('carries the reserved grammar where an option declares one', () => {
    expect(reference).toContain('a bare tag name');
  });

  it('sends the reader to the docs page for the meaning of an option', () => {
    expect(reference).toContain('https://oekazuma.github.io/svelte-vitals/rules/architecture/directory-naming');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/setup-skill.test.ts`
Expected: FAIL — cannot resolve `../src/install/setup-skill-content.js`.

- [ ] **Step 3: Write the generator's machine-derived half**

Create `packages/cli/src/install/setup-skill-content.ts`:

```ts
import { allRules, docsUrlFor, type RuleOptionSpec } from '@svelte-vitals/core/internal';
import { oneLine } from './skill-content.js';

/** An option carrying no signal to check against: an empty list or map. An integer option always
 * has a real numeric default, so it never counts as empty. Mirrors skill-content.ts's rule for
 * the same reason — a rule whose every option is empty examines nothing until configured. */
function isEmptyDefault(spec: RuleOptionSpec): boolean {
  if (spec.kind === 'string-list') return spec.default.length === 0;
  if (spec.kind === 'string-map') return Object.keys(spec.default).length === 0;
  return false;
}

function optionLine(name: string, spec: RuleOptionSpec): string {
  const grammar = spec.kind === 'string-list' && spec.pattern ? ` — each entry is ${spec.pattern.describe}` : '';
  return `  - \`${name}\` (${spec.kind}, default \`${JSON.stringify(spec.default)}\`)${grammar}`;
}

/**
 * Every rule that takes options, with its option names, kinds, defaults and reserved grammars.
 * What an option *means* is deliberately absent: `RuleOptionSpec` has no description field, and
 * the difference between (say) `scopes` and `unitScopes` lives only on the rule's docs page — so
 * each entry ends at that URL and the skill's workflow requires opening it.
 */
export function configurableRulesReference(): string {
  const entries = allRules
    .filter((rule) => rule.options)
    .map((rule) => {
      const specs = Object.entries(rule.options!);
      const inert = specs.length > 0 && specs.every(([, spec]) => isEmptyDefault(spec));
      const mark = inert ? ' — **inert until configured**' : '';
      const options = specs.map(([name, spec]) => optionLine(name, spec)).join('\n');
      return `- **${rule.id}** — ${oneLine(rule.title)}${mark}\n${options}\n  - meaning: ${docsUrlFor(rule.id)}`;
    });
  return entries.join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/setup-skill.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm --filter svelte-vitals typecheck
git add packages/cli/src/install/setup-skill-content.ts packages/cli/test/setup-skill.test.ts
git commit -m "feat(cli): derive a configurable-rules reference for the setup skill"
```

---

### Task 5: the handwritten half — workflow and mapping tables

**Files:**

- Modify: `packages/cli/src/install/setup-skill-content.ts` (`buildSetupSkillMarkdown`)
- Modify: `packages/cli/test/setup-skill.test.ts`

**Interfaces:**

- Consumes: `configurableRulesReference()` from Task 4.
- Produces: `export function buildSetupSkillMarkdown(header: string): string` — the whole
  `SKILL.md`, frontmatter included. Task 6's generator and drift test call exactly this.

**Source of truth:** `docs/superpowers/specs/2026-08-23-setup-skill-design.md`. Transcribe its "Workflow", "Derivation sources" and both mapping tables into the skill body. The spec is written for a reader deciding; the skill is written for an agent executing — keep every table row and every disposition, and drop the rationale paragraphs that only explain why the design is the way it is.

Non-negotiable content, each of which exists because a review caught its absence:

1. The five phases in order, with Phase 3 stating that the measured candidate is the **complete future config file** (existing config merged with additions), written as a plain object literal — not the `defineConfig` form, which cannot resolve `svelte-vitals` from a scratch directory.
2. The markuplint same-name rule (`a11y/<markuplint name>` when it exists), the exception table including `require-accessible-name` → `a11y/accessible-name`, and the **catch-all**: any markuplint rule in none of the three lists is reported as unconvertible.
3. markuplint's `extends`/presets (absence under a preset means _on_, not unset), `severity` (`error` → `critical`, `warning`/`info` carry over), `nodeRules`/`childNodeRules` (selector-scoped, unconvertible) and `overrides` (map onto `overrides[].files`).
4. Element lists that use selector syntax are unconvertible — the `elements` grammar rejects them fatally at config load.
5. The check-file table, the four-casing vocabulary, and that `SCREAMING_SNAKE_CASE` / `FLAT_CASE` / custom globs are reported as unconvertible.
6. The tree-inference counting unit: one candidate glob key and its immediate children, route segments decoded first, below ~80% agreement propose nothing.
7. The markuplint version the tables were checked against: **4.18**.
8. Phase 5's handoff: if no Vite plugin, hooks or CI workflow was found, run `svelte-vitals install` for those targets, config target excluded.
9. Collection options **add to** a rule's built-in default rather than replacing it. Immaterial for
   the inert rules whose defaults are empty, wrong to assume for any other rule the skill touches.
10. The non-neighbour derivations: `svelte-seo` / `svelte-meta-tags` / a local meta component
    determine `metaComponents` (the source provider already ships adapters for the first two), and
    the adapter plus prerender configuration inform the recommended `treatDynamicAs`.

- [ ] **Step 1: Write the failing tests for the non-negotiable content**

Append to `packages/cli/test/setup-skill.test.ts`, extending its import to bring in
`buildSetupSkillMarkdown`:

```ts
describe('the setup skill body', () => {
  const md = buildSetupSkillMarkdown('<!-- generated -->');

  it('carries the frontmatter name and the given header', () => {
    expect(md.startsWith('---\nname: setup-svelte-vitals\n')).toBe(true);
    expect(md).toContain('<!-- generated -->');
  });

  it('states the markuplint version its tables were checked against', () => {
    expect(md).toContain('4.18');
  });

  it('carries a catch-all so an unmapped markuplint rule is reported, not guessed', () => {
    expect(md).toMatch(/unconvertible/);
    expect(md).toContain('require-accessible-name');
  });

  it('tells the agent a preset makes absence mean on, not unset', () => {
    expect(md).toContain('extends');
    expect(md).toMatch(/absent[^.]*preset|preset[^.]*absent/i);
  });

  it('requires the measured candidate to be the complete future config', () => {
    expect(md).toMatch(/complete future config/i);
  });

  it('hands the non-config targets back to install', () => {
    expect(md).toContain('svelte-vitals install');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/setup-skill.test.ts`
Expected: FAIL on the five new assertions.

- [ ] **Step 3: Write the body**

Add `buildSetupSkillMarkdown(header)` to `setup-skill-content.ts`, following the ten points above and the spec. It returns frontmatter, then the header, then the body. Structure it as: frontmatter → header → `# setup-svelte-vitals` → `## When to use` → `## Workflow` (the five phases) → `## Deriving from markuplint` → `## Deriving from eslint-plugin-check-file` → `## Inferring from the tree` → `## Configurable rules` (`${configurableRulesReference()}`).

The frontmatter description decides whether the skill ever fires. Write it to match how a user asks for this, not what it does internally:

```ts
description: 'Set up svelte-vitals in a SvelteKit project: inspect what the project already uses, derive a svelte-vitals.config from its markuplint / eslint-plugin-check-file config and its actual directory conventions, measure each candidate rule before adopting it, and hand the remaining targets to `svelte-vitals install`. Use when asked to set up, configure, adopt or onboard svelte-vitals, or to fill in the config file — including the first run on a project that has never used it.';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/setup-skill.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm --filter svelte-vitals typecheck
git add packages/cli/src/install/setup-skill-content.ts packages/cli/test/setup-skill.test.ts
git commit -m "feat(cli): write the setup skill's workflow and derivation tables"
```

---

### Task 6: ship it — pipeline, drift guard, mapping guards

**Files:**

- Modify: `packages/cli/scripts/gen-skills.js`
- Modify: `packages/cli/test/skills-repo.test.ts`
- Modify: `packages/cli/test/setup-skill.test.ts`
- Create: `skills/setup-svelte-vitals/SKILL.md` (generated — do not write by hand)
- Create: `.changeset/setup-skill.md`

**Interfaces:**

- Consumes: `buildSetupSkillMarkdown` from Task 5, `REPO_SKILLS_HEADER` from `./skill-content.js`.
- Produces: nothing further depends on it.

- [ ] **Step 1: Write the failing guards**

Append to `packages/cli/test/setup-skill.test.ts` — these are the two guards the design names, and they exist because the spec's own first draft named a rule that does not exist:

```ts
describe('the mapping tables name things that exist', () => {
  const md = buildSetupSkillMarkdown('<!-- generated -->');
  const ids = new Set(allRules.map((r) => r.id));

  it('every svelte-vitals rule id in the body is a real rule', () => {
    const cited = [...md.matchAll(/`((?:a11y|seo|architecture|correctness|security|performance)\/[a-z0-9-]+)`/g)].map(
      (m) => m[1]!
    );
    expect([...new Set(cited)].filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every option name the tables reference exists on its rule', () => {
    // Pairs the body relies on. Add a row here when the tables start naming another option.
    const pairs: Array<[string, string]> = [
      ['architecture/directory-naming', 'directories'],
      ['a11y/disallowed-element', 'elements'],
      ['a11y/required-element', 'elements']
    ];
    for (const [id, option] of pairs) {
      const rule = allRules.find((r) => r.id === id);
      expect(rule, id).toBeDefined();
      expect(Object.keys(rule!.options ?? {}), `${id}.${option}`).toContain(option);
    }
  });
});
```

Add the third case to `packages/cli/test/skills-repo.test.ts`:

```ts
it('setup-svelte-vitals', () => {
  expect(committed('setup-svelte-vitals'), REGENERATE).toBe(buildSetupSkillMarkdown(REPO_SKILLS_HEADER));
});
```

and extend that file's imports:

```ts
import { buildSetupSkillMarkdown } from '../src/install/setup-skill-content.js';
```

- [ ] **Step 2: Run to verify the drift test fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/skills-repo.test.ts test/setup-skill.test.ts`
Expected: `setup-svelte-vitals` FAILs — `skills/setup-svelte-vitals/SKILL.md` does not exist yet. The two mapping guards should already PASS; if either fails, the body written in Task 5 names something that does not exist — fix the body, not the test.

- [ ] **Step 3: Emit the third skill**

In `packages/cli/scripts/gen-skills.js`, add the import and the array entry:

```js
import { buildSetupSkillMarkdown } from '../dist/install/setup-skill-content.js';
```

```js
const skills = [
  ['svelte-vitals', buildSkillMarkdown(REPO_SKILLS_HEADER)],
  ['improve-svelte', buildImproveSkillMarkdown(REPO_SKILLS_HEADER)],
  ['setup-svelte-vitals', buildSetupSkillMarkdown(REPO_SKILLS_HEADER)]
];
```

- [ ] **Step 4: Generate and verify**

```bash
pnpm format
pnpm --filter svelte-vitals run gen:skills
pnpm format
pnpm --filter svelte-vitals exec vitest run test/skills-repo.test.ts test/setup-skill.test.ts
```

Expected: PASS, and `git status` shows the new `skills/setup-svelte-vitals/SKILL.md`. Read the generated file once end to end — it is the deliverable, and this is the only step where a human-shaped read happens.

- [ ] **Step 5: Changeset**

`.changeset/setup-skill.md`:

```markdown
---
'svelte-vitals': minor
---

Add the `setup-svelte-vitals` agent skill, distributed alongside the other two via `npx skills add oekazuma/svelte-vitals`. Where `install` scaffolds a config file with every option commented out, this one derives the config from the project: it reads an existing markuplint or eslint-plugin-check-file config, infers the conventions a project without either already follows, measures each candidate rule with `--config` before anything is written, and decides adoption per rule. It exists mainly for the rules that ship inert — the ones that examine nothing until a project fills their options in.
```

- [ ] **Step 6: Full verify and commit**

```bash
set -o pipefail
pnpm lint && pnpm typecheck && pnpm test && pnpm check:publish && pnpm smoke
git add -A
git commit -m "feat(cli): ship the setup-svelte-vitals skill"
```

---

## Verification of the whole plan

After Task 6, from a clean tree:

```bash
set -o pipefail
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm check:publish && pnpm smoke
pnpm --filter docs run translate:check
git status --short   # expect empty — every generated file committed
```

Then exercise the flag by hand once, because a passing test suite is not the same as a working CLI:

```bash
printf "export default { rules: { 'seo/title-presence': 'off' } };\n" > /tmp/sv-try.config.js
node packages/cli/dist/bin.js examples/kitchen-sink --config /tmp/sv-try.config.js --reporter json \
  | python3 -c "import json,sys; print('title-presence:', json.load(sys.stdin)['rules'].get('seo/title-presence'))"
```

Expected: `title-presence: None` — the rule is off under the named config, while the gallery's own committed config leaves it on.
