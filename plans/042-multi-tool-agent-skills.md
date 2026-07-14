# Plan 042: Write the generated agent skills to Claude Code, Codex, and Cursor at once

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e30438c..HEAD -- packages/cli/src/install/ packages/cli/test/install/ docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (additive — writes to two new destination paths per skill
  target in addition to the existing one; the existing destination and its
  content are unchanged. `cursor-rules` (the `.mdc` target) is untouched.)
- **Depends on**: none (builds on plan 041, already merged)
- **Category**: dx
- **Planned at**: commit `e30438c`, 2026-07-14

## Why this matters

Plan 041 shipped `claude-skill-improve` as a Claude-Code-only artifact
(`.claude/skills/improve-svelte/SKILL.md`), and the pre-existing `claude-skill`
target has the same limitation (`.claude/skills/svelte-vitals/SKILL.md`).
Meanwhile both Codex CLI and Cursor now read the same `SKILL.md` convention
Claude Code uses (frontmatter `name`/`description`, directory name determines
the invocable command), confirmed against each tool's own docs:

- **Codex CLI** reads skills from `.agents/skills/<name>/SKILL.md` (project,
  searched from cwd up through the repo root) and `~/.agents/skills/<name>/SKILL.md`
  (personal). Source: <https://learn.chatgpt.com/docs/build-skills>. Codex's
  older `~/.codex/prompts/*.md` custom-prompt mechanism was removed in
  v0.117.0 and is not a viable target — its replacement is this skills system.
- **Cursor** reads skills from `.cursor/skills/<name>/SKILL.md` (project,
  nested directories supported) and `~/.cursor/skills/` /
  `~/.agents/skills/` (personal/global) — and for compatibility also reads
  `.claude/skills/` and `.codex/skills/` directly. Source:
  <https://cursor.com/docs/context/commands>. Frontmatter is the same
  `name`/`description` shape, and the invocable command name is likewise
  taken from the directory name, not the frontmatter `name` field.

So today, a user who runs `svelte-vitals install --client claude-skill` (or
`claude-skill-improve`) and works in Codex or Cursor instead of Claude Code
gets nothing — despite the generated _content_ being 100% tool-agnostic
prose (it never mentions Claude Code specifically). The fix does not need a
second content format: the same generated Markdown, written to three
conventional directories instead of one, makes both existing skills
(`svelte-vitals` and `improve-svelte`) usable from Claude Code, Codex, and
Cursor with zero extra user action beyond picking `--client claude-skill` /
`claude-skill-improve` once, same as today.

`cursor-rules` (`.cursor/rules/*.mdc`) stays exactly as it is — it is a
different mechanism (always-loaded context, not an invocable skill) and the
maintainer explicitly chose to keep it separate rather than fold it into
this change.

## Current state

- `packages/cli/src/install/agent-targets.ts` — `AgentTarget` has a single
  `relPath: string` field; `AGENT_TARGETS` has exactly one destination per
  skill target:

  ```ts
  export type AgentTargetId = 'claude-skill' | 'cursor-rules' | 'claude-skill-improve';

  export interface AgentTarget {
    id: AgentTargetId;
    label: string;
    hint: string;
    /** cwd-relative destination path. */
    relPath: string;
  }

  export const AGENT_TARGETS: AgentTarget[] = [
    {
      id: 'claude-skill',
      label: 'Claude Code skill',
      hint: 'Teaches the agent svelte-vitals rules + when to run the scanner',
      relPath: '.claude/skills/svelte-vitals/SKILL.md'
    },
    {
      id: 'cursor-rules',
      label: 'Cursor rules',
      hint: 'Project rules file so Cursor avoids flagged patterns up front',
      relPath: '.cursor/rules/svelte-vitals.mdc'
    },
    {
      id: 'claude-skill-improve',
      label: 'Claude Code improve-svelte skill',
      hint: 'Senior-advisor audit → implementation plans (read-only), for a project-wide improvement roadmap',
      relPath: '.claude/skills/improve-svelte/SKILL.md'
    }
  ];
  ```

- `packages/cli/src/install/index.ts` — `planForAgentTarget` returns exactly
  one `PlanRow` per target, using `target.relPath` directly:

  ```ts
  function agentTargetContent(id: AgentTargetId, version: string): string {
    switch (id) {
      case 'claude-skill':
        return buildSkillMarkdown(version);
      case 'cursor-rules':
        return buildCursorRules(version);
      case 'claude-skill-improve':
        return buildImproveSkillMarkdown(version);
      default: {
        const _exhaustive: never = id;
        throw new Error(`svelte-vitals: unhandled agent target id: ${String(_exhaustive)}`);
      }
    }
  }

  function planForAgentTarget(target: AgentTarget, io: InstallIO, force: boolean, version: string): PlanRow {
    const path = join(io.cwd, target.relPath);
    const existing = io.readFile(path);
    const content = agentTargetContent(target.id, version);
    const status: WriteStatus = existing === undefined ? 'created' : force ? 'updated' : 'exists';
    return { id: target.id, label: target.label, path, status, content };
  }
  ```

  It's called from two places, both currently expecting a single `PlanRow`:

  ```ts
  // runInstall, non-refresh path:
  for (const agentId of agentIds) {
    const target = agentTargetById(agentId)!;
    rows.push(planForAgentTarget(target, io, flags.force ?? false, version));
  }
  ```

  ```ts
  // runRefresh:
  for (const target of AGENT_TARGETS) {
    const path = join(io.cwd, target.relPath);
    try {
      if (io.readFile(path) === undefined) continue;
      rows.push(planForAgentTarget(target, io, /* force */ true, version));
    } catch (err) {
      hadFailure = true;
      io.errorLog(`svelte-vitals: failed to read ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  ```

  `PlanRow` itself (`{ id, label, scope?, path, status, content?, snippet? }`)
  already models exactly one destination path per row — this plan does NOT
  change `PlanRow`'s shape; it changes `planForAgentTarget` to return
  `PlanRow[]` (one row per destination path) instead of a single `PlanRow`,
  which the existing `rowLine()` printer and write loop already handle
  correctly for any `PlanRow[]` regardless of how the rows were produced (they
  iterate `rows: PlanRow[]` generically — confirmed by reading both call
  sites' surrounding code and `rowLine()`/the write loop in full).

- `packages/cli/src/install/cli.ts` — `INSTALL_HELP` describes `claude-skill`/
  `claude-skill-improve` as writing to a single Claude-Code-specific path
  each (see the current full string in `packages/cli/src/install/cli.ts`,
  the `claude-skill`/`claude-skill-improve` paragraphs).

- `packages/cli/test/install/agent-targets.test.ts` — asserts a singular
  `relPath` field (`agentTargetById('claude-skill')?.relPath`).

- `packages/cli/test/install/run.test.ts` — every agent-target test reads
  from exactly one path in `writes` (e.g.
  `writes['/proj/.claude/skills/svelte-vitals/SKILL.md']`).

- `docs/src/content/docs/guides/cli.md` (and the `ja/` counterpart) —
  describes `claude-skill`/`claude-skill-improve` as writing to a single
  Claude-Code path each.

- No test or code anywhere else references `AgentTarget.relPath` — confirmed
  via `grep -rn "\.relPath" packages/cli/src packages/cli/test` before
  starting (re-run this yourself as part of the drift check; if it turns up
  a reference not listed above, treat that as a STOP condition since it means
  this plan's "Current state" is incomplete).

## Commands you will need

| Purpose   | Command                                    | Expected on success |
| --------- | ------------------------------------------ | ------------------- |
| Build     | `pnpm --filter svelte-vitals... build`     | exit 0              |
| Typecheck | `pnpm --filter svelte-vitals... typecheck` | exit 0              |
| Tests     | `pnpm --filter svelte-vitals... test`      | all pass            |
| Lint      | `pnpm lint`                                | exit 0              |
| Docs      | `pnpm --filter docs check`                 | exit 0              |

(Same commands as plan 041; the `docs check` step may be unrunnable in a
network-restricted sandbox — see plan 041's own notes on this. Prose-review
the docs diff manually if so, and say so plainly rather than silently
skipping it.)

## Scope

**In scope**:

- `packages/cli/src/install/agent-targets.ts` — `relPath: string` →
  `relPaths: string[]`; `AGENT_TARGETS`' `claude-skill` and
  `claude-skill-improve` entries each get three paths (see Steps); `cursor-rules`
  keeps its single path, just wrapped in a one-element array.
- `packages/cli/src/install/index.ts` — `planForAgentTarget` returns
  `PlanRow[]`; update its two call sites; `runRefresh`'s per-target existence
  check becomes per-path.
- `packages/cli/src/install/cli.ts` — `INSTALL_HELP` wording.
- `packages/cli/test/install/agent-targets.test.ts` — `relPath` → `relPaths`
  assertions, extended to check all three paths per multi-path target.
- `packages/cli/test/install/run.test.ts` — extend every agent-target test
  to assert on all destination paths; add a new test for the
  partially-already-installed case (see Test plan).
- `docs/src/content/docs/guides/cli.md` and
  `docs/src/content/docs/ja/guides/cli.md` — update the `claude-skill`/
  `claude-skill-improve` paragraphs to describe the three destinations and
  name Codex/Cursor explicitly.
- `.changeset/multi-tool-agent-skills.md` (new).

**Out of scope** (do NOT touch, even though related):

- `packages/cli/src/install/skill-content.ts`,
  `packages/cli/src/install/improve-skill-content.ts` — the generated
  _content_ does not change at all in this plan, only where it's written.
  Do not edit `buildSkillMarkdown`, `buildCursorRules`, or
  `buildImproveSkillMarkdown`.
- `cursor-rules` / `buildCursorRules` — stays a single-destination,
  `.mdc`-format target. Do not add `.agents/skills/` or `.cursor/skills/`
  destinations for it, and do not change its content format. This was an
  explicit maintainer decision, not an oversight.
- Renaming the `claude-skill`/`claude-skill-improve` target ids (e.g. to
  something tool-neutral like `agent-skill`) — that would break existing
  `--client claude-skill` scripts/CI non-interactively. Keep the id strings;
  only `label`/`hint` (display-only) may change.
- `packages/cli/src/install/clients.ts` (the `claude-code`/`cursor`/`codex`
  MCP-client registration targets) and their selection logic — this plan
  does not couple skill-file generation to MCP client selection; picking
  `claude-skill` remains a separate, explicit choice from picking `codex`/
  `cursor`/`claude-code` as an MCP client, exactly as today.
- Any change to `.codex/skills/` — Codex's own docs (cited above) name
  `.agents/skills/` as its skill location; do not also write a
  `.codex/skills/` copy on the theory that it might also work — that path
  isn't documented as read by anything and would just be a fourth,
  unjustified copy.

## Git workflow

- Branch: `advisor/042-multi-tool-agent-skills`
- Commit per logical step (e.g. one commit for the source change, one for
  tests, one for docs+changeset) — conventional commits, scoped:
  `feat(cli): write generated agent skills to Claude Code, Codex, and Cursor`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Give `AgentTarget` multiple destination paths

In `packages/cli/src/install/agent-targets.ts`, replace the whole file's
`AgentTarget` interface and `AGENT_TARGETS` array with:

```ts
export type AgentTargetId = 'claude-skill' | 'cursor-rules' | 'claude-skill-improve';

export interface AgentTarget {
  id: AgentTargetId;
  label: string;
  hint: string;
  /**
   * cwd-relative destination paths. The same generated content is written to
   * every path in this list — Claude Code, Codex, and Cursor all read the
   * same SKILL.md convention (frontmatter name/description, directory name
   * decides the invocable command), just from different directories, so one
   * skill install target can serve all three without a second content
   * format. A single-path target (cursor-rules, whose .mdc format is
   * Cursor-specific) is just a one-element array.
   */
  relPaths: string[];
}

// Agent instruction-file install targets with metadata for the CLI wizard. Unlike the
// MCP clients and Vite targets, these are wholly generated from core's rule metadata, so
// --force is safe to apply (see index.ts).
export const AGENT_TARGETS: AgentTarget[] = [
  {
    id: 'claude-skill',
    label: 'Agent skill: svelte-vitals',
    hint: 'Teaches the agent svelte-vitals rules + when to run the scanner (Claude Code, Codex, Cursor)',
    relPaths: [
      '.claude/skills/svelte-vitals/SKILL.md',
      '.agents/skills/svelte-vitals/SKILL.md',
      '.cursor/skills/svelte-vitals/SKILL.md'
    ]
  },
  {
    id: 'cursor-rules',
    label: 'Cursor rules',
    hint: 'Project rules file so Cursor avoids flagged patterns up front',
    relPaths: ['.cursor/rules/svelte-vitals.mdc']
  },
  {
    id: 'claude-skill-improve',
    label: 'Agent skill: improve-svelte',
    hint: 'Senior-advisor audit → implementation plans (read-only), for a project-wide improvement roadmap (Claude Code, Codex, Cursor)',
    relPaths: [
      '.claude/skills/improve-svelte/SKILL.md',
      '.agents/skills/improve-svelte/SKILL.md',
      '.cursor/skills/improve-svelte/SKILL.md'
    ]
  }
];

/** Lookup an agent instruction-file target by its id. */
export function agentTargetById(id: string): AgentTarget | undefined {
  return AGENT_TARGETS.find((t) => t.id === id);
}

/** Whether an id is one of the agent instruction-file install targets. */
export function isAgentTargetId(id: string): id is AgentTargetId {
  return AGENT_TARGETS.some((t) => t.id === id);
}
```

**Verify**: `pnpm --filter svelte-vitals... typecheck` → fails (expected —
`index.ts` still references `target.relPath`, which no longer exists; this
confirms the type change took effect). Proceed to Step 2 before re-checking.

### Step 2: Make `planForAgentTarget` return one row per path

In `packages/cli/src/install/index.ts`, replace `planForAgentTarget`:

```ts
function planForAgentTarget(target: AgentTarget, io: InstallIO, force: boolean, version: string): PlanRow[] {
  const content = agentTargetContent(target.id, version);
  return target.relPaths.map((relPath) => {
    const path = join(io.cwd, relPath);
    const existing = io.readFile(path);
    const status: WriteStatus = existing === undefined ? 'created' : force ? 'updated' : 'exists';
    return { id: target.id, label: target.label, path, status, content };
  });
}
```

Update its call site in `runInstall` (non-refresh path) to spread the
returned array instead of pushing it directly:

```ts
for (const agentId of agentIds) {
  const target = agentTargetById(agentId)!;
  rows.push(...planForAgentTarget(target, io, flags.force ?? false, version));
}
```

`agentTargetContent` itself is unchanged — leave it exactly as it is.

**Verify**: `pnpm --filter svelte-vitals... typecheck` → exit 0 (the
`runInstall` call site is now fixed; `runRefresh`'s call site is handled
next, since it needs different logic, not just a spread).

### Step 3: Make `runRefresh` check existence per path, not per target

`runRefresh`'s current per-target existence check (`if (io.readFile(path)
=== undefined) continue`, using the target's single old `path`) must become
per-path, since a target can now be "partially installed" (e.g. only the
Claude Code copy exists, not yet the Codex/Cursor ones) — `--refresh`'s
documented contract ("only regenerates files that already exist; it never
creates one") must hold per individual file, not per target as a whole.

Replace the `runRefresh` loop body:

```ts
async function runRefresh(io: InstallIO, flags: InstallFlags, version: string): Promise<number> {
  let hadFailure = false;
  const rows: PlanRow[] = [];
  for (const target of AGENT_TARGETS) {
    const content = agentTargetContent(target.id, version);
    for (const relPath of target.relPaths) {
      const path = join(io.cwd, relPath);
      // readFile maps only ENOENT to undefined and rethrows everything else (EACCES, EISDIR, …),
      // so treat a per-path read failure like a per-path write failure: report it, keep
      // refreshing the other paths/targets, and exit 2 at the end.
      try {
        if (io.readFile(path) === undefined) continue;
        rows.push({ id: target.id, label: target.label, path, status: 'updated', content });
      } catch (err) {
        hadFailure = true;
        io.errorLog(`svelte-vitals: failed to read ${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (rows.length === 0) {
    if (hadFailure) return 2;
    io.errorLog(
      'svelte-vitals: no generated agent files found — run `svelte-vitals install --client claude-skill,cursor-rules` first.'
    );
    return 0;
  }

  const planText = rows.map(rowLine).join('\n');
  io.log('Plan:');
  io.log(planText);

  if (flags.dryRun) {
    io.log('Dry run — no files written.');
    return hadFailure ? 2 : 0;
  }

  for (const r of rows) {
    try {
      io.writeFile(r.path, r.content ?? '');
      io.log(`✓ ${r.label}: ${r.status} ${r.path}`);
    } catch (err) {
      hadFailure = true;
      io.errorLog(`svelte-vitals: failed to write ${r.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (hadFailure) return 2;

  io.log('');
  io.log(`✓ refreshed ${rows.length} file(s).`);
  return 0;
}
```

(Only the double-`for` loop body changed — every line after the loop is
identical to what's already there; reproduce the rest of the function
verbatim from the current file.)

**Verify**: `pnpm --filter svelte-vitals... typecheck` → exit 0 (no
remaining reference to the removed `target.relPath` anywhere —
`grep -rn "\.relPath\b" packages/cli/src` should return no matches; note
the `\b` so it doesn't also flag `relPaths`).

### Step 4: Update the CLI help text

In `packages/cli/src/install/cli.ts`, update the `claude-skill`/
`claude-skill-improve` paragraph of `INSTALL_HELP`:

```
                    claude-skill writes an agent skill (Claude Code, Codex, and Cursor —
                    .claude/skills/, .agents/skills/, and .cursor/skills/ under svelte-vitals/);
                    cursor-rules writes a Cursor rules file (.cursor/rules/svelte-vitals.mdc).
                    Both are generated from the current rule set and support --force to regenerate.
                    claude-skill-improve writes a second, read-only agent skill (same three
                    locations, under improve-svelte/) that audits the whole project and writes
                    implementation plans instead of a run-after-every-edit playbook; also
                    supports --force.
```

Replace only that paragraph; every other line of `INSTALL_HELP` (the
`--client <ids>` id list, the Vite-target paragraph, `--scope`/`--yes`/
`--dry-run`/`--force`/`--refresh`/`--help` lines) is unchanged — the id list
itself doesn't need editing since no ids are added or renamed.

**Verify**: `pnpm --filter svelte-vitals... typecheck` → exit 0;
`pnpm --filter svelte-vitals... test` → the existing `cli.test.ts` test that
asserts the help text contains `claude-skill-improve` still passes (it's a
substring check, unaffected by the wording change around it).

## Test plan

Model these after the existing tests in the same files; the goal is to
confirm every skill target now writes identical content to all of its
destination paths, and that partial-existing states are handled correctly.

- **`packages/cli/test/install/agent-targets.test.ts`**: rename every
  `.relPath` assertion to `.relPaths`, checking the array:

  ```ts
  it('agentTargetById resolves a known id', () => {
    expect(agentTargetById('claude-skill')?.relPaths).toEqual([
      '.claude/skills/svelte-vitals/SKILL.md',
      '.agents/skills/svelte-vitals/SKILL.md',
      '.cursor/skills/svelte-vitals/SKILL.md'
    ]);
    expect(agentTargetById('cursor-rules')?.relPaths).toEqual(['.cursor/rules/svelte-vitals.mdc']);
    expect(agentTargetById('claude-skill-improve')?.relPaths).toEqual([
      '.claude/skills/improve-svelte/SKILL.md',
      '.agents/skills/improve-svelte/SKILL.md',
      '.cursor/skills/improve-svelte/SKILL.md'
    ]);
  });
  ```

  Also update the `each target has a non-empty label, hint, and relPath`
  test to check `t.relPaths.length` is at least 1 and every entry is
  non-empty, instead of a single string's length.

- **`packages/cli/test/install/run.test.ts`**:
  - Update `claude-skill: not present → created, ...` and
    `claude-skill-improve: not present → created, ...` to assert **all
    three** destination paths were written with the same content (identical
    string), not just the `.claude/skills/` one.
  - Update `--force regenerates an already-existing agent target file` and
    the `claude-skill-improve` equivalent similarly — assert all three
    paths got the refreshed content.
  - Update `dry-run does not write agent target files` — unchanged in
    substance (still asserts `writes` is empty), no new assertions needed
    since it's a negative check.
  - Update `a plan can mix an MCP client and an agent target in one run` —
    the expected `Object.keys(writes).sort()` list now has 4 entries
    instead of 2 for the `claude-skill` case (3 skill paths + `.mcp.json`),
    sorted.
  - **New test** — a project that already has the OLD single-path install
    (only `.claude/skills/svelte-vitals/SKILL.md` on disk, matching what
    plan 041 and earlier shipped) should, on a fresh non-force install,
    report that one path as `exists` and the other two as newly `created`:

    ```ts
    it('claude-skill: an old single-path install gets the two new destinations created alongside the existing one', async () => {
      const { io, writes, out } = fakeIO({
        files: { '/proj/.claude/skills/svelte-vitals/SKILL.md': 'stale single-tool content' }
      });
      const code = await runInstall({ client: ['claude-skill'], yes: true }, io, noPrompts, '9.9.9');
      expect(code).toBe(0);
      expect(writes['/proj/.claude/skills/svelte-vitals/SKILL.md']).toBeUndefined(); // not force, so left alone
      expect(writes['/proj/.agents/skills/svelte-vitals/SKILL.md']).toContain('svelte-vitals 9.9.9');
      expect(writes['/proj/.cursor/skills/svelte-vitals/SKILL.md']).toContain('svelte-vitals 9.9.9');
      expect(out.join('\n')).toContain('already configured');
    });
    ```

  - **New test** — `--refresh` only touches paths that already exist, even
    when other paths for the same target don't:

    ```ts
    it("--refresh only regenerates the specific paths already on disk, not a target's other destinations", async () => {
      const { io, writes } = fakeIO({
        files: { '/proj/.claude/skills/svelte-vitals/SKILL.md': 'stale' }
      });
      const code = await runInstall({ refresh: true }, io, noPrompts, '2.0.0');
      expect(code).toBe(0);
      expect(writes['/proj/.claude/skills/svelte-vitals/SKILL.md']).toContain('svelte-vitals 2.0.0');
      expect(writes['/proj/.agents/skills/svelte-vitals/SKILL.md']).toBeUndefined();
      expect(writes['/proj/.cursor/skills/svelte-vitals/SKILL.md']).toBeUndefined();
    });
    ```

    (Check the actual `runInstall({ refresh: true }, ...)` call shape
    against how existing `--refresh` tests in this same file invoke it —
    match that pattern exactly rather than guessing the flags object shape.)

Run: `pnpm --filter svelte-vitals... test` → all pass, including the
new/updated cases above.

## Done criteria

- [ ] `pnpm --filter svelte-vitals... build` exits 0
- [ ] `pnpm --filter svelte-vitals... typecheck` exits 0
- [ ] `pnpm --filter svelte-vitals... test` exits 0; all new/updated tests
      from "Test plan" exist and pass
- [ ] `pnpm lint` exits 0
- [ ] `pnpm --filter docs check` exits 0 (or, if unrunnable in a
      network-restricted sandbox, the docs diff is manually prose-reviewed
      and that limitation is stated plainly, matching plan 041's precedent)
- [ ] `grep -rn "\.relPath\b" packages/cli/src packages/cli/test` returns no
      matches (confirms the singular field was fully replaced, not left as
      dead code alongside the new one)
- [ ] Manually built the CLI and ran
      `install --client claude-skill --dry-run` against a scratch dir —
      the printed plan shows all three destination paths
      (`.claude/skills/svelte-vitals/SKILL.md`,
      `.agents/skills/svelte-vitals/SKILL.md`,
      `.cursor/skills/svelte-vitals/SKILL.md`)
- [ ] Ran the same install for real (no `--dry-run`) and confirmed all
      three files exist on disk with byte-identical content
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] A changeset exists: `.changeset/multi-tool-agent-skills.md` with
      `'svelte-vitals': minor` and a one-paragraph summary
- [ ] `plans/README.md` status row for 042 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `AgentTarget`, `AGENT_TARGETS`, `planForAgentTarget`, or `runRefresh` have
  a different shape than quoted in "Current state" (re-run the drift check
  at the top of this file).
- `grep -rn "\.relPath\b" packages/cli/src packages/cli/test` (run BEFORE
  starting, as part of drift-checking) turns up a reference to
  `AgentTarget.relPath` anywhere not already listed in "Current state" —
  that means this plan's file inventory is incomplete.
- A step's verification fails twice after a reasonable fix attempt.
- You find that Cursor or Codex do NOT actually read one of the three
  documented locations (e.g. by testing with the real tool, if available) —
  this would mean the "Why this matters" research is wrong for that tool;
  stop and report which location doesn't work rather than silently dropping
  it or guessing a replacement.
- The change would require modifying `cursor-rules`/`buildCursorRules` in
  any way — it must stay untouched per this plan's explicit scope.

## Maintenance notes

- If Cursor or Codex ever change their skill-discovery directory
  conventions, the fix is a one-line change to the relevant `relPaths` entry
  in `agent-targets.ts` — no other code changes needed, since
  `planForAgentTarget`/`runRefresh` already treat every path in the array
  identically.
- The `claude-skill`/`claude-skill-improve` target ids are now slightly
  misleading (they write to more than just Claude Code) but were
  deliberately kept for `--client` backward compatibility — see "Out of
  scope". A future major-version cleanup could rename them
  (`agent-skill`/`agent-skill-improve`) with a deprecation path for the old
  ids; not this plan.
- A reviewer should scrutinize: (a) that all three written files are
  byte-identical (same `content` value reused across the `.map()` in
  `planForAgentTarget`, not regenerated per-path, which would waste work and
  risk subtle drift if `agentTargetContent` ever became non-deterministic),
  and (b) that `runRefresh`'s per-path existence check really does leave
  non-existent paths alone rather than creating them (this is the core
  "refresh is not install" contract and is easy to get subtly wrong when
  restructuring a loop).
