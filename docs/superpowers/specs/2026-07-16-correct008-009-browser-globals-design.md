# CORRECT008/009 — Browser globals in server-executed code

**Date:** 2026-07-16
**Status:** Approved design
**Packages:** `@svelte-vitals/core` (facts + rules), `svelte-vitals` / `@svelte-vitals/vite` / `@svelte-vitals/mcp` (surface automatically)

## Goal

Add two rules catching `window` / `document` / `localStorage` (and friends)
accessed in code that runs on the server, where those globals do not exist —
the classic SSR `ReferenceError: window is not defined` 500:

- **CORRECT008** (`critical`) — access in **server-executed module code**:
  module scope of `.svelte.ts`/`.svelte.js` and `.svelte` `<script module>`
  (crashes at import), and Kit route/hooks files (top level, load/handler
  bodies, the `init` hook — crashes at import or per request).
- **CORRECT009** (`warning`) — access at the **top level of a component's
  instance script**: it runs on the server on every SSR render of the
  component. Warning, not critical, because a component rendered only behind
  a parent's `{#if browser}` (or a client-only dynamic import) is a
  legitimate pattern that cannot be proven cross-file.

Rule-selection criterion (maintainer, 2026-07-16): overlap with
eslint-plugin-svelte's `no-top-level-browser-globals` is accepted — the
deploy-blocker test dominates the duplication test.

## Background (verified 2026-07-16)

- eslint-plugin-svelte 3.20.0's `no-top-level-browser-globals` derives its
  global list dynamically (`globals.browser` minus `globals.node` — hundreds
  of names incl. generic words like `name`/`status`) and relies on eslint's
  scope analysis to match only unresolved global references. svelte-vitals
  has no scope-resolution engine, so adopting that list verbatim would
  false-positive on ordinary identifiers. A **curated high-signal list** is
  the correct adaptation.
- Its recognised guards: `browser` from `$app/environment`, `typeof X !==
'undefined'` checks, and `onMount` bodies. In svelte-vitals, function
  bodies (incl. `onMount`/`$effect` callbacks and event handlers) are already
  excluded by the eval-scope walk (`EVAL_SCOPE_BOUNDARIES`), so only the
  `browser`/`typeof` guard skipping is new machinery.
- Existing infrastructure reused: eval-scope walking with shadow tracking
  (CORRECT006/007), the Kit channel with handler/`init` identification
  (SEC003–005, CORRECT007), the wrap parser with −1 line shift.

## Design

### Approach decision

**A (chosen): a dedicated position-aware scanner + facts on both channels.**
Rejected: B — reusing `collectEvalScopeCalls` (it detects calls; identifier
reads need parent/position awareness — forcing it would be a hack); C —
eslint-style full scope analysis to unlock the complete `globals` list
(an order-of-magnitude bigger engine for the ~10% tail; YAGNI).

### 1. Tracked globals (curated, module-level constant `BROWSER_GLOBALS`)

`window`, `document`, `localStorage`, `sessionStorage`, `navigator`,
`location`, `history`, `screen`, `matchMedia`, `requestAnimationFrame`,
`cancelAnimationFrame`, `IntersectionObserver`, `ResizeObserver`,
`MutationObserver`, `alert`, `confirm`, `prompt` (17 names).

Names available in Node (e.g. `fetch`, `setTimeout`, `console`,
`URL`) are deliberately absent; generic browser-only names with high
collision risk (`name`, `status`, `length`, …) are deliberately absent.

### 2. Scanner — `collectBrowserGlobalRefs(program, source, …)` (component-parse.ts, shared with the Kit parser)

1. **Pre-pass** — names that disqualify a candidate for the whole program:
   every import's local name and every top-level declaration name
   (export-unwrapped; `const document = …` / `import { window } from
'happy-dom'` are real bindings, not global reads). Also collect the
   **guard binding**: the local name(s) of `browser` value-imported from
   `'$app/environment'` (alias-resolved).
2. **Walk** — stops at eval-scope boundaries (functions/classes never run at
   module evaluation / component init) and threads the shadow set
   (CORRECT007's mechanism), so `onMount`/`$effect` callbacks, event
   handlers, and locally shadowed names never match. **Position discipline**
   (modeled on `bodyReadsReactive`): an `Identifier` matches only in read
   positions — never as a non-computed `MemberExpression.property`, a
   non-computed `Property.key`, a declaration id, a function/method name, an
   import/export specifier, or a label. `window.innerWidth` matches via the
   `window` object position. A bare `typeof window` operand does **not**
   match — `typeof` on an undeclared name does not throw and is itself the
   guard idiom.
3. **Guard skipping** — an `IfStatement` / `ConditionalExpression` /
   `LogicalExpression` whose test contains (a) a reference to a guard
   binding (`browser`) or (b) a `typeof <tracked-global> === | !==
'undefined'` comparison is skipped **entirely, including the else
   branch** — a `window` access in the server branch of `if (browser) … else
…` is a conservative miss, documented.
4. Output `{ name: string; line: number }[]` in walk (source) order.

### 3. Facts

- `ComponentFacts.browserGlobalRefs: { name: string; line: number; context: 'module' | 'instance' }[]`
  — `.svelte.ts`/`.svelte.js`: whole program as `'module'` (wrap −1 shift).
  `.svelte`: `<script module>` as `'module'`, and — a first for this fact
  family — the **instance script** as `'instance'` (its top level runs on
  the server during SSR). Each script's own pre-pass runs on its own program
  (imports may live in either script; the guard binding set is the union of
  both scripts' imports).
- `KitModuleFacts.browserGlobalRefs: { name: string; line: number; inHandler: boolean }[]`
  — flag positions identical to CORRECT007's `lifecycleCalls`: top level,
  handler bodies, the `init` hook; helper functions exempt. **Same-file
  opt-out**: when the file itself has `export const ssr = false`
  (satisfies-unwrapped, top-level or alias export), the whole fact array
  stays empty — the file never runs on the server. `csr = false` does not
  opt out (that declares server-only rendering; the globals still crash).

### 4. Rules

**CORRECT008 — `Browser global in server module code`** (`critical`,
`category: 'correctness'`, `scope: 'component'`): custom `check(ctx)` (the
CORRECT007 shape) reading `ComponentFacts.browserGlobalRefs` filtered to
`context === 'module'` plus `KitModuleFacts.browserGlobalRefs`. Messages:

- module: `` `${name} is accessed at module scope — it does not exist on the server, so importing this file crashes SSR with "${name} is not defined"` ``
- kit `inHandler`: `` `${name} is accessed in a load/handler — it runs on the server during SSR, where ${name} is not defined` ``
- kit top-level/`init`: the module message.

**CORRECT009 — `Browser global during component initialisation`**
(`warning`, built with the `componentRule` factory): flags
`browserGlobalRefs` with `context === 'instance'`. Message:
`` `${name} is accessed during component initialisation — during SSR this runs on the server, where ${name} is not defined` ``.

Shared `recommendation`: `"Move browser-only code into onMount or $effect (they never run on the server), or guard it with browser from $app/environment (or a typeof check)."`

Rationales state the crash class (008) and the warning reasoning — the
unprovable client-only-component pattern (009).

### 5. Registration, docs, changeset

Four registration sites per rule + grep checks. Docs:
`docs/src/content/docs/rules/correct008.md`, `correct009.md` + ja mirrors;
CLI-guide suppression range (en/ja) `CORRECT001–007` → `CORRECT001–009`.
Changeset: core / `svelte-vitals` / vite / mcp — **minor**.

## Testing

- **Scanner**: reads of representative globals (bare + member-object
  position); `typeof window` operand not flagged; non-computed property
  key/member-property not flagged; local declaration and import of a
  tracked name excluded; nested shadowing excluded; `browser` guard
  (plain + aliased) skips if/ternary/`&&`; `typeof` guard skips;
  function/`onMount`/`$effect` bodies excluded; module vs instance context
  split in `.svelte`; wrap −1 lines in `.svelte.ts`.
- **Kit**: access in `load` body (`inHandler: true`); top level and `init`
  (`false`); helper function exempt; `export const ssr = false` empties the
  facts; `csr = false` does not.
- **Rules**: severities and message variants; both channels for 008;
  suppression per channel; rendered-mode no-op; 009 via `componentRule`
  semantics.
- Full existing suite unchanged; root `pnpm build` / `typecheck` / `test` /
  `lint` green.

## Known limitations / out of scope (v1, documented in the rule docs)

- **Guard else-branches are skipped entirely** — a server-side branch of
  `if (browser) … else …` that touches a browser global is a conservative
  miss.
- **Client-only components are unprovable cross-file** (parent `{#if
browser}`, dynamic import) — the reason CORRECT009 is a warning, with the
  inline suppression as the escape hatch.
- **`ssr = false` opt-out is same-file only** — a root `+layout.ts` turning
  SSR off app-wide is not detected.
- **`import.meta.env.SSR` guards are not recognised** (v1).
- **Template expressions are not scanned** (`{window.innerWidth}` in markup
  also runs during SSR — future extension).
- **Indirect access is not tracked** (`globalThis.window`, `const w =
window` at a guarded site then used elsewhere).
- The curated list trades recall for precision — browser-only APIs outside
  the 17 names are not flagged.
