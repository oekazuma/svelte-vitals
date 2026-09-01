# Decision: keep the Runtime seam's rule invariants as prose, for now

Outcome of the 2026-09-01 architecture review (deepening candidates 1–4 shipped; this one was
considered and deliberately not built).

## The observation

The `Runtime` interface (`packages/core/src/runtime.ts`) is four methods, but most of its lines
are prose encoding two rules' implementation details into the adapter contract: dot entries must
be excluded from `glob` results (the directory-shaped Architecture rules derive their directory
set from that inventory), and every returned path must be a file (a rule takes a directory's
immediate children from the same inventory). None of it is expressed by the type system, so
writing a new adapter requires reading rule implementations in a different layer.

## Why nothing was built

- **No third adapter exists or is asked for.** Both current adapters are the same Node
  implementation (the CLI's `createNodeRuntime` and the Vite plugin's `nodeRuntime`), duplicated
  because core purity rules out a shared `node:`-importing home — a decision recorded in the code
  (`packages/vite/src/glob.ts`). Hardening the contract serves a Deno/Bun adapter that has no
  demand yet.
- **The dot-entry invariant is structural, not liftable.** Excluding dot directories must happen
  _during_ traversal — a post-filter in core would mean walking `.git/` first. (`node_modules/`
  is a separate concern: the glob patterns are rooted under `src/` and never reach it.) So core
  can own the policy only as an exported predicate that adapters apply; the enforcement point
  stays in the adapter either way. The win is small against the speculative need.

## Upgrade path, when a real second runtime appears

Export the exclusion policy from core as a predicate (one home for the rule), have both adapters
apply it, and move whatever invariants a post-collection check _can_ verify into core so a
misbehaving adapter fails loudly. Revisit only when a Deno/Bun (or other non-Node) adapter is
actually being written — that is the moment the prose contract starts costing something.
