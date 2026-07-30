# SvelteKit alias resolution — design

**Date:** 2026-07-30
**Status:** approved
**Unblocks:** `architecture/route-component-import`
(`2026-07-30-route-component-import-design.md`), and widens the reach of three shipped rules.

## The problem

`resolveRepoLocalPath` (`packages/core/src/kit-module-parse.ts`) turns an import specifier into a
project-relative path. It understands exactly two forms: `$lib/…`, hard-coded to `src/lib/…`, and
relative specifiers. Everything else returns `undefined`, meaning "not a project-local module" — which
is how every rule built on it decides to stay silent.

A project that declares its own aliases through `kit.alias` therefore has most of its imports invisible
to those rules. That was recorded in the charter as a light pre-1.0 constraint. **Measurement retired
that estimate**: in a real monorepo of several SvelteKit apps, a custom alias is used more widely than
`$lib`, and `$lib` is deliberately forbidden there by a lint rule. For that repo the affected rules do
not under-report a little — they are nearly blind.

There is a second, worse form of the same gap. `$lib` is not a constant: `kit.files.lib` moves it. A
project that moves it gets `$lib/…` resolved to `src/lib/…` anyway — not a miss but a **wrong answer**,
pointing at a file that is not the one imported.

## Scope

Read from `svelte.config.{js,ts}`:

- **`kit.alias`** — the project's declared aliases.
- **`kit.files.lib`** — where `$lib` actually points.

Not read: Vite's own `resolve.alias`, which is a second mechanism with two value shapes (an object, and
an array of `{ find, replacement }`). `kit.alias` is the SvelteKit-idiomatic form, it is what generates
the `tsconfig` paths, and it is what the measured repo uses. Left out until something asks for it.

Also still not read: `kit.files.routes`. That gap belongs to the rules that assume `src/routes`, and is
not made better or worse here.

## Design

### `$lib` stops being a special case

Reading `kit.files.lib` is what makes the implementation simpler rather than larger, because `$lib`
becomes an ordinary entry in the alias map instead of a branch of its own:

```ts
// The default map is what reproduces today's behaviour when no config declares anything.
declare function resolveRepoLocalPath(
  spec: string,
  importerFile: string,
  aliases?: Record<string, string> // default: { $lib: 'src/lib' }
): string | undefined;
```

1. A relative specifier resolves against the importing file's directory — unchanged.
2. Otherwise, take the **longest** matching alias key `K` and replace that prefix with its value.
3. No key matches → `undefined`, as today.

`kit.files.lib` **overrides** the default map's `$lib` value; `kit.alias` entries are **added** to it. The
doc comment on `resolveRepoLocalPath` already demanded this shape — "keep every alias mapping inside
this one function: adding `svelte.config.js` alias support later must stay a single-site change" — and
folding `$lib` in is how that holds without adding a branch.

The merge happens **once, at collection**, not inside the resolver:
`kitAliases = { $lib: filesLib ?? 'src/lib', ...kitAlias }`. So the collected map, whenever it is
present, always carries a `$lib` entry, and the resolver's default parameter covers only the case where
no config was read at all. Spread order gives an explicit `kit.alias.$lib` the last word; that shape is
strange but it is what Vite would do with it, and the resolver should not disagree with the bundler.

**Longest key wins, for determinism.** Vite matches aliases in declaration order; resolving by object
key order would make the answer depend on how the config happens to be written. Longest-prefix is
order-independent and matches how the rest of this codebase breaks specificity ties. Length is measured
on the **raw key**, `/*` suffix included, which is what makes the pair below order-independent too.

### Three key shapes, because Kit defines three

`kit.alias` keys are not all directory prefixes. Kit's own documentation gives all three forms, and the
third one is not a stylistic variant — it changes what matches:

| Key     | Matches `x`? | Matches `x/y`? |
| ------- | ------------ | -------------- |
| `'x'`   | yes          | yes            |
| `'x/*'` | **no**       | yes            |

So the match test is: for a key without a trailing `/*`, `spec === K || spec.startsWith(K + '/')`; for a
key `K + '/*'`, only `spec.startsWith(K + '/')`. A trailing `/*` on the **value** is stripped before
substitution — `'x/*': 'src/x/*'` maps `x/y` to `src/x/y`, the same place `'x': 'src/x'` maps it.

Kit's third documented form is a key whose value is a **file** (`'x': 'src/x.js'`). It needs no separate
handling: the table's first row already describes it, and the nonsense case — `x/y` under a file alias,
substituting to `src/x.js/y` — resolves to a path no file has, so every consumer stays silent for the
same reason it stays silent on an unresolvable specifier.

Because the raw key orders the candidates, a config declaring both `'x'` and `'x/*'` is deterministic
without a tie-break rule: `x/y` takes `'x/*'` (the longer key), and bare `x` takes `'x'` (the only key
that matches it).

The non-`/*` test is a **segment-boundary** test rather than a string-prefix test: a key of `$lib` must
not match `$libFoo`. The `+ '/'` is what enforces that, and it gets its own test because dropping it
looks harmless.

One deliberate widening: today a bare `$lib` (no slash) returns `undefined` and only `$lib/…` resolves.
Under the alias mechanism `$lib` alone resolves to `src/lib`. That is correct by Kit's semantics, and
the existing reasoning in `isLocalStateSpecifier` already assumes bare-directory forms resolve — it
exempts "the directory-entrypoint import itself … resolving to exactly `src/lib/server`".

### The fact

`Project` gains one field:

```ts
kitAliases?: Record<string, string>;
```

No `file` alongside it, unlike `kitPathsBase`, which carries one because a finding points at the config
line. Aliases are never reported; nothing needs their provenance.

**Collection adds no I/O.** `collectProjectFacts` already reads `svelte.config.{js,ts}` for
`kit.paths.base`, so the aliases come out of a source string that is already in hand. That is worth
stating precisely because `packages/cli/test/io-budget.test.ts` holds the collection phase to a fixed
number of `Runtime` calls, and `AGENTS.md` records that raising a budget needs a reason rather than a
number edit. **This change must not move those numbers**, and that it does not is the mechanical proof
that no new read was introduced.

### Threading it to both resolution sites

Specifiers are resolved in two places, and only one of them is a rule:

- **At rule time.** `architecture/private-scope-import` calls `resolveRepoLocalPath` directly, and the
  planned `architecture/route-component-import` will. Both read `ctx.project.kitAliases`.
- **Inside a fact parser.** `parseKitModuleFacts` calls it through the module-private
  `isLocalStateSpecifier`. So `collectKitModuleFacts` needs the alias map passed in.

The collection order already permits that: both the CLI's `collectAll` and the vite plugin's `analyze`
collect project facts **before** kit-module facts, sequentially. Nothing is reordered and no parallelism
is lost — the collection phase is a straight sequence of awaits today, so there is none between
collectors to lose. (The benchmark's "lost parallelism" concern is about concurrency _within_ a
collector.)

### What the widened reach actually touches

| Rule                                  | Path                      | Default            |
| ------------------------------------- | ------------------------- | ------------------ |
| `architecture/private-scope-import`   | resolves at rule time     | L3, opt-in         |
| `security/handler-state-write`        | via `parseKitModuleFacts` | **on**             |
| `security/shared-state-import`        | via `parseKitModuleFacts` | **on**             |
| `architecture/route-component-import` | resolves at rule time     | on (not yet built) |

`performance/heavy-import` is **not** affected. It matches the raw specifier against a map of bare
package names and never resolves a project-local path — a first draft of the dependent spec claimed
otherwise, which was wrong.

The two `security` rules are affected more narrowly than "they gain reach" suggests.
`isLocalStateSpecifier` gates only the `.set()` / `.update()` shape (`via: 'set-call'`) of
`importedStateWrites`; a plain assignment is recorded whether or not the specifier resolves. **So alias
resolution changes the `set-call` path only.**

Both are on by default, so an alias-using project can see new findings after this lands. They are
findings the rules always owed and could not see, but the changeset has to say so plainly rather than
describe the change as internal.

### The failure to design against is a wrong answer, not a missing one

An unresolved specifier falls back to `undefined`, which every consumer already treats as "cannot see
it, stay silent" — conservative, and identical to today. A *mis*resolved specifier points at a real file
that is not the imported one, and in a default-on security rule that is a false positive.

So the parser is deliberately narrow: **only a string-literal alias value becomes an entry.** A computed
value (`path.resolve(__dirname, 'src')`, a template literal, a spread) is dropped from the map, and
specifiers using it stay exactly as unresolved as they are today.

## Deliberately not solved

- **An alias pointing outside the project root.** Its resolved path escapes, and `normalizePosix`
  already returns `undefined` for that. The measured monorepo contains exactly this shape — one app
  aliases a sibling app's `src` — so it is a real case, not a hypothetical, and the honest answer is
  that svelte-vitals analyses one project and cannot see the file.
- **Vite's `resolve.alias`** (see Scope).
- **`kit.files.routes`**, unchanged.
- **A computed alias value**, as above.
- **An unreadable or unparseable `svelte.config`** — no aliases, today's behaviour.

## Testing

1. **The parser** — a `kit.alias` object literal; a computed value skipped while its literal siblings
   survive; `kit.files.lib`; a config with no `kit` key; an unparseable config; an `alias` whose value is
   not an object.
2. **The resolver** — longest key wins; an exact-key match; a key mapping to a **file** rather than a
   directory; a `'x/*'` key matching `x/y` but **not** bare `x`, alongside a plain `'x'` key that matches
   both; a trailing `/*` on the value stripped; the **segment boundary** (`$lib` must not match
   `$libFoo`); a value escaping the project root giving `undefined`; the default `$lib` when no config
   declares one; `files.lib` overriding `$lib`; an explicit `kit.alias.$lib` overriding `files.lib`; a
   relative specifier unchanged.
3. **Backwards compatibility** — with no alias config, the existing suites of
   `architecture/private-scope-import`, `kit-module-parse`, and the two `security` SSR rules pass
   **unedited**. That is the proof the default map reproduces today's behaviour exactly.
4. **The I/O budget's numbers are unchanged.** CI-enforced, and the mechanical proof that collection
   gained no reads.
5. **End-to-end** — a fixture whose `svelte.config.js` declares an alias, where a shipped rule reports
   something it demonstrably did not report before. Without this the change has no evidence it did
   anything; the first four tests would all pass over a resolver that silently never matched.

## Deliverables

- `findKitAliasesInSvelteConfig` / `resolveKitAliases` in `packages/core/src/svelte-config-parse.ts`,
  beside the existing `paths.base` parsing.
- `Project.kitAliases` in `packages/core/src/types.ts`.
- The third parameter on `resolveRepoLocalPath`, with `$lib` folded into the default map.
- `collectKitModuleFacts` takes the alias map; the CLI's `collectAll` and the vite plugin's `analyze`
  pass `project.kitAliases`.
- `architecture/private-scope-import` passes `ctx.project.kitAliases`.
- A changeset stating that projects declaring `kit.alias` may see new findings from
  `security/handler-state-write` and `security/shared-state-import`, and that `$lib` now honours
  `kit.files.lib`.
- Documentation: the configuration guide gains a note that aliases are read from `svelte.config`, in
  both languages.
