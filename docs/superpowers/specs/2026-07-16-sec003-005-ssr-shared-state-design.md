# SEC003–005 — SSR shared-state leaks (cross-request state on the server)

**Date:** 2026-07-16
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (facts + rules), `svelte-vitals` (CLI wiring), `@svelte-vitals/vite` (wiring), `@svelte-vitals/mcp` (surfaces the rules)

## Goal

Add three security rules that catch SvelteKit's canonical server-state trap —
data stored in module scope on a long-lived, shared server process leaking
between users — before deploy:

- **SEC003** (`critical`): a `load` / form action / request handler **writes to
  imported module state** (`user.set(...)`, `state.user = ...`). The official
  docs' "No side-effects in load" NEVER-DO-THIS. Almost never legitimate.
- **SEC004** (`warning`): a Kit server/universal route file **reassigns a
  module-scope `let`/`var` from inside a function**. The official docs' "Avoid
  shared state on the server" NEVER-DO-THIS (`let user` + `user = ...` in an
  action). Warning, not critical, because `let cached` module caches exist.
- **SEC005** (`warning`): a Kit server/universal file **imports a
  `.svelte.ts`/`.svelte.js` module that holds module-scope `$state`** — on the
  server that instance is shared by every request (written: leak; read-only:
  every user sees the same, boot-time-stale value).

Rule-selection criterion (maintainer, 2026-07-16): "does it catch something
before deploy that would hurt users/business in production?" This is the
highest-business-impact class on the backlog — cross-user data exposure.

This introduces the second analysis surface after CORRECT006's runes modules:
**Kit route files** (`+page.server.ts`, `+page.ts`, `+server.ts`,
`hooks.server.ts`, …), carried on a new `KitModuleFacts` channel.

## Background (verified 2026-07-16)

- **Official SvelteKit docs (kit/state-management)** mark both target patterns
  "NEVER DO THIS": (1) module-scope `let user` in `+page.server.js` assigned
  from an action — "If Alice submitted an embarrassing secret, and Bob visited
  the page after her, Bob would know Alice's secret"; (2) `user.set(await
response.json())` on an imported store inside `load` — "puts one user's
  information in a place that is shared by _all_ users".
- The docs also state the legitimacy boundary that drives the FP strategy:
  "If you're not using SSR … you can safely keep state in a shared module" —
  so flagging every module-scope `$state` in `.svelte.ts` (the idiomatic
  client store) would drown users in false positives. SEC005 therefore fires
  only on the **server-side import** of such a module.
- The compiler already errors on directly-reassigned exported state
  (`cannot export reassigned state` — svelte/svelte-js-files docs), but object
  `$state` exports, class instances, and everything in plain `.ts` Kit files
  compile clean. eslint-plugin-svelte has no rule in this space.
- No existing tool covers this statically; it is runtime-invisible too (works
  perfectly in single-user dev, corrupts silently in production).

## Design

### Approach decision

- **A (chosen): new `KitModuleFacts` channel.** Kit route files are not
  components; riding on `ComponentFacts` again (CORRECT006's approach) would
  add a third semantics to an already-stretched type. CORRECT006's spec said
  "revisit if module-level rules grow to ~3" — this is that moment: three
  rules, a distinct file class, and a cross-channel rule (SEC005). Costs one
  `RuleContext` field and one collector call in the CLI and vite providers.
- B (rejected): extend `ComponentFacts`/glob again — zero wiring but the
  conflation (component = .svelte + runes module + server file) becomes real
  debt; server-file classification would leak into the component parser.
- C (rejected): generic recursive import-graph subsystem — YAGNI; SEC005 v1
  tracks direct imports only, needing just a small specifier resolver.

### 1. Collected files

| kind        | globs                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `server`    | `src/routes/**/+page.server.{ts,js}`, `src/routes/**/+layout.server.{ts,js}`, `src/routes/**/+server.{ts,js}`, `src/hooks.server.{ts,js}` |
| `universal` | `src/routes/**/+page.{ts,js}`, `src/routes/**/+layout.{ts,js}`                                                                            |

Universal files run on the server during SSR, so all three rules apply; the
`kind` reaches the finding message so users understand why. `src/lib/server/**`
is deliberately out of scope for v1 (legitimate singletons — DB connections,
clients — concentrate there; documented limitation).

### 2. Facts — `KitModuleFacts` (`packages/core/src/kit-module.ts`)

```ts
export interface KitModuleFacts {
  file: string;
  kind: 'server' | 'universal';
  /** Module-scope let/var reassigned from inside a function (SEC004). */
  moduleStateReassignments: { name: string; line: number; inHandler: boolean }[];
  /** Writes to an imported binding from inside an exported handler (SEC003). */
  importedStateWrites: { name: string; line: number; via: 'assignment' | 'set-call' }[];
  /** Writes to an imported binding outside handlers (SEC005 write flavour). */
  importedStateWritesOutsideHandlers: { name: string; line: number }[];
  /** Value imports whose specifier resolves to a repo-local .svelte.ts/.svelte.js (SEC005). */
  runesModuleImports: { source: string; resolved: string; names: string[]; line: number }[];
  suppressions: SuppressionDirective[];
}
```

Parsing reuses CORRECT006's `<script lang="ts">` wrap (incl. the `</script`
neutralisation and the −1 line correction); parse/read failures fall back to
empty facts, never a throw. Suppressions use the existing
`svelte-vitals-disable-next-line` text scan on the unwrapped source.

`ComponentFacts` additionally gains `moduleStateDecls: { name: string; line:
number }[]` — populated by `parseModuleFacts` for `.svelte.ts`/`.svelte.js`
files: top-level `let|const x = $state(...)` / `$state.raw(...)` declarations,
plus a module-scope `new` of a same-file class whose body has a `$state` /
`$state.raw` **field initializer** (reusing CORRECT006's top-level class and
`new` scanning; the recorded name is the instance binding where available,
else the class name).

### 3. Handler identification (shared)

Server-executed entry points, identified from exports (arrow or function
expressions, unwrapping `satisfies`/TS type assertions):

- `export function load` / `export const load = …`
- each member of `export const actions = { … }`
- `+server` HTTP method exports: `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`HEAD`/`OPTIONS`/`fallback`
- `hooks.server`: `handle`, `handleFetch`, `handleError`

### 4. Detection

**SEC003 — `Load writes imported state` (critical).** Inside handler bodies
(nested functions included), flag writes whose **root binding is an import**:
property assignment (`user.name = …`, `state.a.b = …`), `UpdateExpression`,
`delete`, destructuring-assignment targets, and `.set(...)` / `.update(...)`
calls on the imported binding (covers svelte stores AND imported module-scope
`Map`s — both shared). Namespace imports (`* as s` → `s.user = …`) count.
Other method calls (`logger.info()`) do not — conservative. Scope-aware via
the existing shadow tracking. The `.set(...)`/`.update(...)` call-form is
additionally gated to repo-local specifiers (relative or `$lib/`, excluding
`$lib/server/`), so `.set`/`.update` on installed packages (Drizzle, KV/redis
clients) or `$lib/server` singletons — persistence, not shared module state —
is not flagged (finding from the final branch review).

**SEC004 — `Server module state` (warning).** Flag reassignments (`=`,
compound, `??=`/`||=`/`&&=`, `UpdateExpression`) of module-scope `let`/`var`
bindings from inside any function body. Top-level (module-evaluation)
reassignments are initialisation — not flagged. Shadowed locals excluded.
`inHandler` distinguishes the message strength (direct handler write vs helper
function). `const` bindings and method-mutation caches (`cache.set(…)`) are
out of scope by decision — documented limitation. Assignments inside
SvelteKit's `init` startup hook (`export function init` / `export const init =
…`) are also not flagged — it runs once at server startup, semantically
top-level initialisation (SEC003/SEC005 write detection is not exempted for
`init`; writing imported shared state from it is still one shared instance).

**SEC005 — `Shared runes-module import` (warning).** For each entry in
`runesModuleImports` whose `resolved` file has non-empty `moduleStateDecls` in
`ctx.components`, emit one finding at the import line. Two flavours:

- imported binding is written outside handlers → "server code mutates shared
  module state"; a binding already reported by SEC003 (written inside a
  handler) is **not** double-reported by SEC005;
- read-only → "on the server this state is shared by every request and stays
  at its boot-time value — a leak if it ever holds per-user data, stale data
  even if not".

Specifier resolution: relative paths and `$lib/` → `src/lib/` only; pure
function, no I/O; `import type` and bare (package) specifiers excluded.

### 5. Rules, helper, wiring

- New files: `packages/core/src/rules/security/sec003-load-state-write.ts`,
  `sec004-server-module-state.ts`, `sec005-shared-state-import.ts`.
- Shared factory `kitModuleRule` (`packages/core/src/rules/kit-module-rule.ts`,
  mirroring `componentRule`): iterates `ctx.kitModules`, applies suppressions,
  emits PASS/PENALIZED with `scope: 'component'` (file = scoring unit). SEC005
  additionally receives `ctx.components` for the cross-channel lookup.
- `RuleContext` gains `kitModules?: KitModuleFacts[]` (unset in rendered mode
  → rules emit nothing, like `components`).
- Collector `collectKitModuleFacts(rt, cwd)` in core; called from the CLI's
  static provider and the vite plugin's analyze path (one line each); MCP
  inherits via the CLI.
- Registration: the usual four sites + docs; MCP category enum unchanged
  (security exists).

## Testing

- **Kit parsing** (`kit-module-parse` tests): handler identification (arrow,
  function, `satisfies`, actions members, HTTP methods, `handle`); SEC003
  write forms (property assignment, nested member root, `.set`, `.update`,
  namespace import, destructuring, `delete`, update-expression) and
  non-findings (local variable writes, `logger.info()`, reads, writes to
  handler parameters); SEC004 reassignment forms (`=`, `??=`, `++`),
  shadowing exclusion, top-level initialisation exclusion, `const` exclusion;
  import resolution (`$lib`, relative, `import type` excluded, bare specifier
  excluded); `kind` classification per glob; line numbers (wrap −1).
- **`moduleStateDecls`** (component-parse tests): `$state` / `$state.raw`
  variable declarations; `$state`-field class + module-scope `new`; not
  flagged: `$state` inside functions, non-state modules.
- **Rules**: severities and messages per flavour; suppression silences each
  rule; SEC003/SEC005 no-double-report on the same binding; `ctx.kitModules`
  unset → no results; SEC005 with matching/non-matching `moduleStateDecls`.
- **Collection**: fixture project with `+page.server.ts`, `+page.ts`, and a
  `$lib` runes-state module — end-to-end facts through
  `collectKitModuleFacts`; parse-failure fail-safe.
- Full `pnpm build` / `typecheck` / `test` / `lint` green.

## Known limitations / out of scope (v1, documented in the rule docs)

- **`src/lib/server/**` is not scanned** — legitimate module singletons (DB
  connections, API clients) live there; scanning it would bury real findings.
- **`const`-based caches** (`const cache = new Map()` + `.set()`) are not
  flagged — deliberate memoisation pattern; request-derived data in such a
  cache is still dangerous but indistinguishable statically.
- **Direct imports only** — a `.svelte.ts` state module re-exported or
  imported transitively through another module is not tracked.
- **No `ssr = false` detection** — fully-SPA projects may see SEC005/SEC003
  findings on universal files that never actually run on a server; use inline
  suppressions. Route-options awareness is a candidate v2 refinement.
- **Dynamic `import()`** is not tracked.
- `.svelte` `<script module>` `$state` is not treated as a shared-state source
  for SEC005 (rare; revisit on demand).

## Docs & changeset

- Rule pages: `docs/src/content/docs/rules/sec003.md` / `sec004.md` /
  `sec005.md` + the three `ja/rules/` mirrors (en/ja ship together).
- Update the suppression range in `guides/cli.md` (en/ja) to `SEC001–005`.
- Changeset: `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`,
  `@svelte-vitals/mcp` — **minor**.
