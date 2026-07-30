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

**But `svelte.config` is only in charge when the Vite config does not carry a Kit config.** Since Kit
2.62, options passed to the `sveltekit()` plugin make `svelte.config` irrelevant — Kit says so out loud:
"svelte.config.js is ignored when options are passed via your Vite config". `resolveKitPathsBase` already
implements that precedence, and alias resolution has to respect it or it produces a **wrong answer** for
such a project: aliases read from a file the bundler ignored. So when the Vite config carries a
`sveltekit(<anything>)` argument, no aliases are read and the default list stands — which is exactly
today's behaviour, so nothing regresses.

Reading `kit.alias` **out of** that plugin config is a separate, larger job (it means generalising the
plugin-config walk) and is deliberately not done here. The cost of skipping it is reach, not correctness:
such a project keeps today's `$lib`-only resolution.

Also still not read: `kit.files.routes`. That gap belongs to the rules that assume `src/routes`, and is
not made better or worse here.

## Design

### The one governing principle: reproduce `get_config_aliases`

Every rule in this section is a restatement of one decision, so it is worth stating alone:

> **The resolver reproduces what the bundler does, mechanism included — not a cleaner scheme that
> usually agrees with it.**

The bundler's mechanism is short enough to hold in mind. `get_config_aliases`
(`@sveltejs/kit/src/exports/vite/utils.js`) builds an **ordered array**, `$lib` **prepended** before any
user entry:

```js
const alias = [
  // For now, we handle `$lib` specially here rather than make it a default value for
  // `config.kit.alias` since it has special meaning for packaging, etc.
  { find: '$lib', replacement: config.files.lib }
];
for (let [key, value] of Object.entries(config.alias)) { …alias.push(…) }
```

and the resolver Vite runs over that array takes the **first** match, not the best one:

```js
const matchedEntry = entries.find((entry) => matches(entry.find, importee));
```

Two consequences fall straight out, and both were wrong in the first draft of this spec.

**A user's `kit.alias.$lib` is dead.** Kit's `$lib` entry sits ahead of it, so `files.lib` always wins.
The first draft merged with `{ $lib: filesLib, ...kitAlias }`, letting the user's value win — the exact
opposite of the bundler.

**Resolution is order-dependent, and reproducing that is the safe choice.** Given
`{ '$a': 'src/x', '$a/b': 'src/y' }` in that order, `$a/b/c` matches `$a` first and resolves to
`src/x/b/c`; the `$a/b` entry is unreachable. A "longest key wins" rule — which the first draft chose,
for determinism — answers `src/y/c`: **a different, possibly existing file**, fed to default-on security
rules. That is precisely the wrong-answer failure this spec sets out to avoid, and avoiding it costs
nothing: the config parser walks an `ObjectExpression`, so source order is already in hand.

The determinism the first draft wanted was never at risk. For a given config the answer is fixed; it is
only _across_ differently-written configs that it varies, and that variation is the bundler's real
behaviour. A checker that resolves an import differently from the bundler that will build it has no
defence for the difference.

### The shape that follows

Because precedence is positional, the fact cannot be a `Record`: a record cannot express "`$lib` first,
and its value wins" when the user also writes `$lib` — the spread would move it or overwrite it. It is an
**ordered list**, and first-match-wins then needs no precedence rule at all, because a duplicate `$lib`
entry is simply never reached.

```ts
type KitAlias = {
  find: string; // the key, any trailing `/*` removed
  replacement: string | null; // normalised value; null when the config's value is not a string literal
  match: 'prefix' | 'contents' | 'exact';
};

// The default list is what reproduces today's behaviour when no config was read.
declare function resolveRepoLocalPath(
  spec: string,
  importerFile: string,
  aliases?: KitAlias[] // default: [{ find: '$lib', replacement: 'src/lib', match: 'prefix' }]
): string | undefined;
```

1. A relative specifier resolves against the importing file's directory — unchanged.
2. Otherwise, take the **first** entry whose `match` test passes. `replacement === null` → `undefined`;
   otherwise replace `find` with `replacement`.
3. No entry matches → `undefined`, as today.

The list is built once, at collection: `$lib` from `kit.files.lib` (or `src/lib`), then `kit.alias` in
declaration order. The doc comment on `resolveRepoLocalPath` already demanded that shape — "keep every
alias mapping inside this one function: adding `svelte.config.js` alias support later must stay a
single-site change".

An entry whose value the parser cannot read stays in the list as an **opaque** entry — `replacement:
null` — rather than being omitted. Step 2 stops there and answers `undefined`. Why that matters is worked
through in "the failure to design against" below; the short version is that omitting it would let a
later entry answer in its place.

### Three match modes, because Kit compiles three

Kit does not treat every key as a directory prefix. It compiles three different entries, and the mode is
decided by the key's shape and by what else the config **declares** — `key + '/*' in config.alias`, read
off the raw config, before any value is looked at. Modes are therefore assigned from the declared key set
and never from whatever subset of entries this parser managed to read a value for.

| Kit's compiled entry                | mode       | Matches `x`? | Matches `x/y`? |
| ----------------------------------- | ---------- | ------------ | -------------- |
| `find: 'x'` (plain string)          | `prefix`   | yes          | yes            |
| `find: /^x\/(.+)$/` — from `'x/*'`  | `contents` | **no**       | yes            |
| `find: /^x$/` — `'x'` + `'x/*'` set | `exact`    | yes          | **no**         |

So the tests are: `prefix` → `spec === find || spec.startsWith(find + '/')`; `contents` →
`spec.startsWith(find + '/')` only; `exact` → `spec === find` only.

The third mode is the one a from-scratch design would miss. When a config declares **both** `'x'` and
`'x/*'`, Kit narrows the `'x'` entry to an exact match, so the two entries partition the space instead of
the first one swallowing everything. Reproducing the mode is what makes `x/y` reach the `'x/*'` entry
even though `'x'` is declared first — under plain first-match-wins it never would.

The `prefix` test is a **segment-boundary** test rather than a string-prefix test: a `find` of `$lib` must
not match `$libFoo`. The `+ '/'` is what enforces that, and it gets its own test because dropping it
looks harmless. It is Vite's own `matches()`, verbatim.

Kit's documentation also shows a key whose value is a **file** (`'x': 'src/x.js'`). That is not a fourth
mode: Kit's compiler never branches on whether the value is a file, so it is a `prefix` entry like any
other, and the nonsense case — `x/y` substituting to `src/x.js/y` — lands on a path no file has, so every
consumer stays silent for the same reason it stays silent on an unresolvable specifier.

### Normalising the value, which measurement showed is not optional

For a `kit.alias` value, Kit posixifies it, strips a trailing `/*`, and then hands it to `path.resolve`,
which quietly absorbs anything else irregular. This resolver works in project-relative strings and never
calls `path.resolve`, so what `resolve` was absorbing has to be done explicitly:

1. **posixify** — `value.replace(/\\/g, '/')`. A config written on Windows can hold `'src\\lib'`.
2. **strip a trailing `/*`** — `'x/*': 'src/x/*'` must map `x/y` to `src/x/y`, exactly where
   `'x': 'src/x'` maps it.
3. **strip trailing slashes** — `value.replace(/\/+$/, '')`. A **trailing-slash value is common, not
   exotic**: measurement found it on the most heavily used alias in the tree. Raw prefix substitution
   would produce `src//lib/api/x`.

Step 3 is belt-and-braces rather than the only defence — `normalizePosix` drops empty segments, so `//`
already collapses. It is written down because that is a _latent_ dependency: the spec's correctness would
otherwise rest on an unstated property of a helper three functions away, and a future edit to
`normalizePosix` could break alias resolution with nothing pointing at the connection.

**All three steps apply to the `$lib` entry too, and the reason above does not explain why.** Kit's `$lib`
entry is `{ find: '$lib', replacement: config.files.lib }` — no `posixify`, no `path.resolve`, unlike
every `kit.alias` value. So there is nothing `resolve` was absorbing for `$lib`, and an implementer
reasoning backwards from step 1–3's justification would exclude it. Normalise it anyway: `kit.files.lib`
is a user-written string with the same irregularities available to it (`'src/library/'` would otherwise
substitute to `src/library//x`), and one normalisation applied uniformly is a smaller thing to keep
correct than two paths that differ for a reason no downstream code can see.

One deliberate widening: today a bare `$lib` (no slash) returns `undefined` and only `$lib/…` resolves.
Under the alias mechanism `$lib` alone resolves to `src/lib`, which is what Kit's `prefix` mode does.
The existing reasoning in `isLocalStateSpecifier` already assumes bare-directory forms resolve — it
exempts "the directory-entrypoint import itself … resolving to exactly `src/lib/server`". Measurement
found no bare alias import in the tree, so the widening is expected to change nothing in practice; it is
taken because it is what the bundler does, not for its reach.

That exemption itself has to move with `$lib`. `isLocalStateSpecifier` exempts writes into the lib
`server/` directory (legitimate DB/KV singletons), and today that directory is `src/lib/server` written
literally. Once `$lib` follows `kit.files.lib`, the literal is wrong for any project that moves it: the
exemption must be derived from the same resolved `$lib` entry (its `replacement`, falling back to
`src/lib` when there is no list or no `$lib` entry) rather than the hard-coded string. Getting this wrong
is not a reach gap — it is exactly the wrong-answer failure this spec exists to avoid, and in the worst
direction: `security/handler-state-write` is critical and default-on, so a project that only moved
`files.lib` and changed nothing else would start failing CI on its existing, legitimate singletons.

**An unreadable `kit.files.lib` cannot collapse into "unmoved" either — that is the same wrong-answer
failure one level up.** `filesLibOf` returns three states, not two: absent (no `lib` property, or `files`
doesn't resolve to an object literal) → `undefined`; a literal → the string; present but not statically a
string (a computed expression) → `null`, the same "opaque, not dropped" treatment `kit.alias` values
already get. `??` must not be allowed to fold that `null` into the `src/lib` default: a project whose
`files.lib` is computed would then get `$lib/x` resolved to `src/lib/x` regardless of where the real
directory is — a wrong answer, not a missing one, exactly the failure this spec exists to avoid.

That opacity then has to reach `isLocalStateSpecifier`. `$lib/…` specifiers already resolve to `undefined`
in that case (an opaque entry blocks resolution, same as any other), so those are already silent. What is
genuinely undecided without a rule is a **relative** specifier: it resolves independently of the alias
list, so it can still land on a path like `src/lib/server/db` even though the true lib root is unknown.
The hard call: when the `$lib` entry is opaque, `isLocalStateSpecifier` returns `false` — not local
state — **unconditionally**, for every specifier, rather than falling back to the `src/lib/server` default
and reporting whatever doesn't match it. The asymmetry that decides this is the same one that opens this
document: an unresolved specifier is conservative (every consumer already treats it as "stay silent"), but
a *mis*resolved one points at a real file that is not the one imported, and `security/handler-state-write`
is critical and default-on, so guessing at the lib root risks a false positive there. Staying silent costs
only a missed finding — the accepted cost throughout this spec — so that is the side this fact chooses.

### The fact

`Project` gains one field, the ordered list from above:

```ts
kitAliases?: KitAlias[];
```

Absent means "no config was read", and the resolver's default parameter covers it. A **collected list is
never empty**: `$lib` is prepended before any user entry, so a config that was read and declared no
aliases yields a one-entry list identical to the default. That invariant is why nothing downstream needs
a "did we read a config" flag, and it is worth asserting in a test — an empty array reaching the resolver
would silently disable `$lib` resolution, turning every rule in the table below into a no-op.

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

| Rule                                  | Resolution site                                 | Default            |
| ------------------------------------- | ----------------------------------------------- | ------------------ |
| `architecture/private-scope-import`   | `resolveRepoLocalPath`, at rule time            | L3, opt-in         |
| `security/handler-state-write`        | `isLocalStateSpecifier`, `set-call` shape only  | **on**             |
| `security/shared-state-import`        | `resolveRunesModuleSpecifier`, **every import** | **on**             |
| `architecture/route-component-import` | `resolveRepoLocalPath`, at rule time            | on (not yet built) |

`performance/heavy-import` is **not** affected. It matches the raw specifier against a map of bare
package names and never resolves a project-local path — a first draft of the dependent spec claimed
otherwise, which was wrong.

The two `security` rules are affected to **very different** degrees, and an earlier draft of this section
got the second one wrong by describing both through one function.

- `security/handler-state-write` reads `importedStateWrites`, and `isLocalStateSpecifier` gates only the
  `.set()` / `.update()` shape (`via: 'set-call'`); a plain assignment is recorded whether or not the
  specifier resolves. Alias resolution widens that one shape.
- `security/shared-state-import` reads `runesModuleImports`, and **every** entry in that fact passes
  through `resolveRunesModuleSpecifier` → `resolveRepoLocalPath`. Its `applies` is
  `runesModuleImports.length > 0`, so an alias-only project produces the fact empty and the rule is
  inert — not narrowed, **off**. For this rule alias resolution is the whole gate.

That asymmetry decides where the end-to-end test points: `security/shared-state-import` is the rule whose
behaviour visibly changes, so it is the one worth driving a fixture through. Note also that its `bad`
requires the resolved path to match an analyzed file carrying module state, which is exactly the
coincidence a mis-resolution needs to become a false positive.

Both are on by default, so an alias-using project can see new findings after this lands. They are
findings the rules always owed and could not see, but the changeset has to say so plainly rather than
describe the change as internal.

### The failure to design against is a wrong answer, not a missing one

An unresolved specifier falls back to `undefined`, which every consumer already treats as "cannot see
it, stay silent" — conservative, and identical to today. A *mis*resolved specifier points at a real file
that is not the imported one, and in a default-on security rule that is a false positive.

So the parser is deliberately narrow about **values**: only a string literal becomes a `replacement`. A
computed value (`path.resolve(__dirname, 'src')`, a template literal, a spread) yields `null`.

It is not narrow about **entries**, and the difference is the whole point. Kit imports the config at
runtime, so a computed value is just a string there and every entry is live; this parser reads an AST and
sees only literals. Dropping the entries it cannot read would make the two lists differ in **length**, and
under first-match-wins a shorter list does not answer less — it answers **differently**:

- **A later entry answers in a dropped entry's place.** With `{ '$a': path.resolve(…), '$a/b': 'src/y' }`,
  Kit resolves `$a/b/c` under `$a`. Dropping `$a` lets `$a/b` take it: `src/y/c`, a different and possibly
  existing file. Note what this breaks — it is not merely "less reach than Kit", it is **worse than
  today**, where the specifier resolves to `undefined`.
- **Modes shift.** Kit assigns `exact` to `'x'` because `'x/*'` is _declared_. With
  `{ '$x': 'src/plain', '$x/*': path.resolve(…) }`, dropping the `'$x/*'` entry re-reads `'$x'` as
  `prefix`, and `$x/y` resolves to `src/plain/y` where Kit answers `undefined`.

Hence the opaque entry: it holds its position and its mode, and answers `undefined` when reached. "A
specifier we cannot resolve stays unresolved" is then true as stated — which it is not if the entry is
dropped.

### An unreadable _key_ is a different problem, and needs a blunter answer

The opaque entry works because an unknown **value** still has a known `find`: the entry can be placed and
tested, it just cannot answer. An unknown **key** has neither. Two config shapes produce one:

```js
alias: { ...shared, '$a': 'src/a' }   // a spread: unknown keys, at a known position
alias: { [KEY]: 'src/a' }            // a computed key
```

An unknown key could match anything, so it could shadow any entry after it — and there is no `find` to
record that with. Positional fidelity is unrecoverable here, so **the whole of `kit.alias` is treated as
unknowable and the list is just `[$lib]`.**

That is a real loss of reach, taken because the alternative is a wrong answer: keeping the literal
siblings would let one of them answer a specifier that Kit hands to the spread's entry instead. `$lib`
survives the blunt answer because it is at index 0 — nothing can shadow it, whatever the user declared.

This mirrors `propOf`'s existing conservatism in `config-object.ts`, which drops a property match when a
later spread could overwrite it: "the effective value is unknowable, so this conservatively returns
undefined". Same reasoning, one level up — from a property's value to the object's key set.

Duplicate literal keys need no such retreat, but they do need care, because `Object.entries` keeps the
**first** position and the **last** value: `{ a: 1, b: 2, a: 3 }` yields `a` at index 0 with value `3`.
The parser reproduces that rather than emitting `a` twice.

## Deliberately not solved

- **An alias pointing outside the project root.** A `../`-relative target escapes and `normalizePosix`
  already returns `undefined` for that. The measured monorepo contains exactly this shape — one app
  aliases a sibling app's `src` — so it is a real case, not a hypothetical, and the honest answer is
  that svelte-vitals analyses one project and cannot see the file. A **literal absolute** value (e.g.
  `alias: { '$shared': '/opt/shared/src' }`) is a second way to point outside the project, and
  `normalizePosix` does _not_ catch it on its own — it silently drops the leading empty segment, turning
  `/opt/shared/src/x` into the project-relative-LOOKING `opt/shared/src/x` rather than failing. That is a
  wrong answer, not a missing one, so the resolver checks for a leading `/` on the matched alias's
  `replacement` explicitly and answers `undefined` there too, same as the relative form.
- **Vite's `resolve.alias`**, and **`kit.alias` inside a `sveltekit()` plugin config** (see Scope). The
  second costs reach only: such a project keeps today's `$lib`-only resolution instead of a wrong one.
- **`kit.files.routes`**, unchanged.
- **A computed alias value** — recorded as an opaque entry, never resolved (see above). Evaluating the
  config would resolve it, and is out of the question: `packages/core` performs no I/O and runs no user
  code.
- **An unreadable or unparseable `svelte.config`** — no aliases, today's behaviour.

## Testing

1. **The parser** — a `kit.alias` object literal; a computed value yielding `replacement: null` while its
   literal siblings keep theirs; `kit.files.lib`; **a computed `kit.files.lib` compiling to an opaque
   `$lib` entry (`replacement: null`) rather than the `src/lib` default**, and a `$lib/…` specifier under
   that list resolving to `undefined`; **a relative specifier that would otherwise be exempt as local
   `lib/server/` state instead staying unreported when the `$lib` entry is opaque** — the one path shape
   where the "fall back to the default and report" failure and the fix actually diverge; a config with no
   `kit` key; an unparseable config; an `alias` whose value is not an object. Plus the two structural
   invariants: **`$lib` is at index 0** of every list the parser produces, and **source order is
   preserved** for the user entries (a fixture
   declaring three aliases, asserted as a list, not as a set).
2. **Value normalisation** — a trailing slash (`'src/'`); a backslash value (`'src\\lib'`); a trailing
   `/*`; and all three at once. Each asserted on the produced `replacement`, so a fixture cannot pass
   merely because `normalizePosix` cleaned up afterwards. **And the same on a `kit.files.lib` value**,
   since that is the entry whose normalisation the stated rationale does not cover.
3. **The resolver, mode by mode** — `prefix` matching both `x` and `x/y`; `contents` (from `'x/*'`)
   matching `x/y` but **not** bare `x`; `exact` (from `'x'` when `'x/*'` also exists) matching `x` but
   **not** `x/y`; a value that is a file; the **segment boundary** (`$lib` must not match `$libFoo`); a
   value escaping the project root giving `undefined`; a relative specifier unchanged.
4. **Bundler fidelity, as its own group.** These are the cases where an intuitive scheme and Kit disagree,
   so each one fails under the first draft's design and is the reason the design changed:
   - **First match, not best match** — `{ '$a': 'src/x', '$a/b': 'src/y' }` in that order resolves
     `$a/b/c` to `src/x/b/c`. Under longest-key-wins it would be `src/y/c`.
   - **Order matters** — the same two keys declared the other way round resolve `$a/b/c` to `src/y/c`.
     The pair together is what pins order-dependence; either test alone is satisfiable by a fixed rule.
   - **`kit.alias.$lib` is dead** — a config setting both `files.lib` and `alias.$lib` resolves `$lib/x`
     under **`files.lib`**. This is the assertion the first draft would have failed.
   - **A user alias shadowed by `$lib`** — `alias: { '$lib/server': 'src/other' }` never fires, because
     Kit's `$lib` entry precedes it.
   - **An opaque entry blocks rather than disappears** — `{ '$a': <computed>, '$a/b': 'src/y' }` resolves
     `$a/b/c` to `undefined`, **not** to `src/y/c`. Dropping the entry is the failure this pins, and note
     the expected value is the one today's code already gives, so the test also states the "no worse than
     today" claim.
   - **An opaque entry still fixes its neighbour's mode** — `{ '$x': 'src/plain', '$x/*': <computed> }`
     resolves `$x/y` to `undefined`, because `'$x'` is `exact` on the strength of `'$x/*'` being declared.
     Bare `$x` still resolves to `src/plain`, which is what separates "mode preserved" from "everything
     went opaque".
   - **An unreadable key discards the whole of `kit.alias`** — a config with a spread, and one with a
     computed key, both resolve a literal sibling's specifier to `undefined` while `$lib/x` still
     resolves. The second half is what stops the retreat from being over-broad.
   - **Duplicate literal keys take the first position and the last value** —
     `{ '$a': 'src/one', '$b': 'src/two', '$a': 'src/three' }` resolves `$a/x` to `src/three/x`, and a
     config adding `'$a/b': 'src/four'` after them still resolves `$a/b/c` under `$a` (position 0, not
     position 2).
5. **Config precedence** — a project with a `sveltekit({ … })` Vite config **and** a `svelte.config`
   declaring aliases resolves under the default list, not under those aliases. `sveltekit()` with no
   argument leaves `svelte.config` in charge, so its aliases do apply.
6. **Backwards compatibility** — with no alias config, the existing suites of
   `architecture/private-scope-import`, `kit-module-parse`, and the two `security` SSR rules pass
   **unedited**. That is the proof the default list reproduces today's behaviour exactly.
7. **The I/O budget's numbers are unchanged.** CI-enforced, and the mechanical proof that collection
   gained no reads.
8. **End-to-end** — a fixture whose `svelte.config.js` declares an alias, where a shipped rule reports
   something it demonstrably did not report before. Without this the change has no evidence it did
   anything; every test above would pass over a resolver that silently never matched.

## Deliverables

- `findKitAliasesInSvelteConfig` / `resolveKitAliases` in `packages/core/src/svelte-config-parse.ts`,
  beside the existing `paths.base` parsing. `resolveKitAliases` owns the ordering invariant (`$lib`
  first), the mode assignment from the raw declared key set, and the value normalisation — applied to
  every entry, `$lib` included.
- `KitAlias` and `Project.kitAliases` in `packages/core/src/types.ts`.
- The third parameter on `resolveRepoLocalPath`, taking the ordered list, with `$lib` as its default
  entry.
- `collectKitModuleFacts` takes the alias list; the CLI's `collectAll` and the vite plugin's `analyze`
  pass `project.kitAliases`.
- `architecture/private-scope-import` passes `ctx.project.kitAliases`.
- A changeset stating that projects declaring `kit.alias` may see new findings from
  `security/handler-state-write` and `security/shared-state-import`, and that `$lib` now honours
  `kit.files.lib`.
- Documentation: the configuration guide gains a note that aliases are read from `svelte.config`, in
  both languages.
