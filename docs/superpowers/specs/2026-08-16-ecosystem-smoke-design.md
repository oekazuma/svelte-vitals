# Ecosystem smoke — design

Phase B-3 of `2026-08-16-v1-roadmap.md`. A scheduled job that runs the built CLI against real
third-party SvelteKit apps and asserts only that it did not fall over. The roadmap already fixed the
assertions ("no crash, exit ∈ {0,1}, report parses — never counts"); this records the decisions it
left open.

## Why, and — precisely — what it does not cover

The recent run of engine bugs all came from pointing the tool at code nobody wrote for it. This job
turns one class of that luck into a standing net, and it is worth being exact about which class,
because the ratio is not flattering:

| bug                                         | class          | caught here?   |
| ------------------------------------------- | -------------- | -------------- |
| `#508` `<style lang="scss">` aborts the run | crash / exit 2 | **yes**        |
| `#495` `<link>` same-rel collapse           | wrong findings | no             |
| `#496` `<script src>` same-src collapse     | wrong findings | no             |
| `#499` a11y inline directive not matched    | wrong findings | no             |
| minify-flag closure loss                    | vite plugin    | no — see below |

So: **one of five.** A wrong-findings bug exits 0 or 1 with a report that parses, and sails through
green. This job catches the class that stops a project being analyzable at all — which is the class
that makes the tool useless to a whole population of users silently, and the class no fixture can
anticipate, because a fixture is written by us.

Two limits that follow, stated so nobody mistakes a green run for more than it is:

- **False positives are invisible.** A rule firing wrongly on real code is a finding, and this job
  never reads findings. The kitchen-sink `/clean/*` canaries are where that is defended.
- **The Vite plugin is entirely out of scope.** The job runs `packages/cli/dist/bin.js` only.
  Covering the plugin would mean installing each target's dependencies and running `vite build` —
  minutes per repo and a new failure surface owned by upstream's lockfile. If plugin-mode crashes
  become a pattern, that is a separate design, not a corpus row.

It is also **not** a correctness suite. It never asserts a score, a finding count, or a rule id:
those move with every release by design (`2026-08-16-score-semantics-freeze.md`), and asserting them
would make the job a maintenance tax that gets muted.

## Measured before committing to the corpus

All eleven candidates were shallow-cloned and run against the built CLI on 2026-08-16. Timings are
the analysis alone, on a laptop.

| repo                         | path              | exit  | routes | time   |
| ---------------------------- | ----------------- | ----- | ------ | ------ |
| `huntabyte/shadcn-svelte`    | `docs`            | 1     | 1681   | 1225ms |
| `lissy93/networking-toolbox` | `.`               | 2 → 0 | 541    | 1100ms |
| `itswadesh/svelte-commerce`  | `.`               | 0     | 409    | 895ms  |
| `rajnandan1/kener`           | `.`               | 1     | 385    | 1114ms |
| `seanmorley15/AdventureLog`  | `frontend`        | 0     | 147    | 1589ms |
| `imputnet/cobalt`            | `web`             | 0     | 115    | 449ms  |
| `sveltejs/svelte.dev`        | `apps/svelte.dev` | 1     | 86     | 348ms  |
| `scosman/CMSaasStarter`      | `.`               | 1     | 63     | 269ms  |
| `matiadev/joy-of-code`       | `.`               | 0     | 58     | 253ms  |
| `VERT-sh/VERT`               | `.`               | 0     | 57     | 324ms  |
| `animotionjs/animotion`      | `.`               | 0     | 19     | 233ms  |

Two facts from that run shaped everything below:

- **No target needs its dependencies installed.** A `git clone --depth 1` is enough; the analysis is
  static. That is what makes the job cheap enough to be boring.
- **`networking-toolbox` exited 2.** Fixed in `#508` before this job exists, so the corpus is green
  at birth — a net that is red on day one is noise, not a net.

## The corpus

Eight of the eleven, chosen for the shape of the input rather than for popularity:

| repo                         | path              | why it is in                                          |
| ---------------------------- | ----------------- | ----------------------------------------------------- |
| `sveltejs/svelte.dev`        | `apps/svelte.dev` | the framework's own site — idiomatic by definition    |
| `huntabyte/shadcn-svelte`    | `docs`            | route-count stress at 1681                            |
| `imputnet/cobalt`            | `web`             | a large app in a monorepo subpath                     |
| `seanmorley15/AdventureLog`  | `frontend`        | a subpath beside a non-JS backend                     |
| `rajnandan1/kener`           | `.`               | a self-hosted product app, heavy dynamic routing      |
| `lissy93/networking-toolbox` | `.`               | the SCSS canary — `#508` regresses here first         |
| `matiadev/joy-of-code`       | `.`               | a content site: markdown pipeline, few components     |
| `scosman/CMSaasStarter`      | `.`               | a template, i.e. what a new user's project looks like |

Dropped: `VERT`, `animotion`, `svelte-commerce` — real apps, but each duplicates a shape already
covered, and every added repo is clone time on every run.

## Decisions

**Floating, not pinned.** The corpus tracks each repo's default branch. Pinning would make the job
a slower copy of the kitchen-sink e2e; the value is precisely that upstream keeps writing Svelte we
did not anticipate. The reproducibility cost is paid by printing `repo @ <sha>` for every target, so
a failure names the exact tree.

**Third-party config files are deleted after clone.** The CLI dynamically imports
`svelte-vitals.config.{mjs,js,ts}` from the target directory — that is how config loading works, and
the kitchen-sink suppression test depends on it. Cloning arbitrary repos and running the CLI in them
is therefore arbitrary code execution in CI the moment any of them adopts the tool. Deleting the
file after clone removes the vector. Discovery is `cwd`-only with no upward walk, and the script
always passes an explicit path, so deleting in the target directory is sufficient — including for
the monorepo subpath targets. It is the only project file the tool executes: `svelte.config.js` and
`vite.config.ts` are parsed, never run.

**The resolved target must be inside the resolved clone.** The corpus picks the subpath, but
upstream picks what lives at it, and a repo may commit a symlink there. Without the check, deleting
config files would unlink through it and the analysis would run somewhere else entirely. Both paths
go through `realpathSync` and the target is rejected unless it is the clone root or beneath it.

**Suppressions are switched off with `--no-suppressions`.** A separate concern from the config file
and not a security one — `svelte-vitals-suppressions.json` is read with `JSON.parse`, never
imported. But it is read from the analyzed directory unconditionally, so a target that adopts the
tool would silently hide findings from this job, and a file written against a future format version
is a **hard exit 2** — the code this job reads as an engine crash. Using the flag rather than
deleting the file keeps the intent in the command line, where a reader of the CI log sees it.

**Scheduled and manual, never PR-blocking.** Weekly plus `workflow_dispatch`. Upstream is free to
break the job through no fault of ours (a repo moves, a clone 404s), and that must never be able to
block a merge. It also runs on pull requests **that touch the script or the workflow**, so a corpus
edit is validated by the thing it edits.

**Every target runs, failures are collected, the job fails at the end.** A dead clone in target 2
must not hide a crash in target 6.

**No secrets, `permissions: contents: read`.** The job clones untrusted code; its blast radius is
kept at zero regardless of the config deletion above.

**No issue automation.** A red run on the Actions tab is the deliverable. Auto-filing issues is
scope to add if silence ever proves to be the problem.

## The assertions, per target

1. The clone succeeds and the analysis exits within its timeout.
2. The exit code is `0` or `1`. **`2` is the failure this job exists to catch** — it is the CLI's
   "not a SvelteKit project / internal error" code, and every target is known to be a SvelteKit
   project.
3. `--reporter json` stdout parses, and carries `score`, `routes`, and `rules`.

Nothing else. No count, no score, no rule id.

## Testing

The job is its own test. What needs pinning in the repo is that the script's contract does not rot:
it lives beside `floor-smoke.mjs`, uses Node builtins plus `git` only, and runs the built `dist`
under a bare `node` — so a dev dependency can never leak into it.
