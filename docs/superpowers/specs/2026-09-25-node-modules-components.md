# Following components from installed npm packages — design

**Date:** 2026-09-25
**Status:** approved
**Builds on:** `2026-09-25-workspace-package-resolution.md` (package entries compiled from
`exports`, first match wins, opaque entries, a package directory as an entry's `root`), which left
npm packages in `node_modules` out.

## The problem

A route whose head comes from a component in an npm package (`import { Head } from '@acme/ui'`,
`import SeoHeader from '@misiki/kitcommerce-core/components'`) reads as missing every tag that
component renders, because a bare specifier resolves to nothing. Two holdouts in four had an app
whose whole head came from such a component. In one of them it was 952 of 1,065 false positives.
Known meta libraries have adapters, and `metaComponents` lets a user say "trust this one". Neither
covers a library nobody wrote an adapter for, and `metaComponents` only marks the head as broad. It
never sees the tags themselves or the headings the component renders.

## What is followed

When the checkout is installed, the `<head>`/heading walk reads the components of the Svelte
packages the app declares, from `node_modules`, the way Vite would.

1. **Which packages.** Only names the app's own `package.json` declares in `dependencies`,
   `devDependencies` or `peerDependencies` with a range that is not a local protocol (`workspace:`,
   `link:`, `file:`, `portal:`). `catalog:`, `npm:` aliases, semver ranges, tags and git URLs all
   count. A local-protocol dependency is the workspace resolver's, whose bounds (the package stays
   inside the repository) must not be sidestepped through its `node_modules` link.
2. **Where they are.** Node's lookup. The first `node_modules/<name>/package.json` wins, starting in
   the app's directory and going upward. The walk stops at the directory holding `.git`, inclusive.
   Without a `.git` it reads only the app's own `node_modules`. It never goes above the repository,
   so a stray `~/node_modules` is never read.
3. **Only Svelte packages.** A package counts when its manifest has a `svelte` field or a `svelte`
   condition anywhere in `exports`, which is what `svelte-package` publishes. Other packages get no
   entries.
4. **How a subpath resolves.** The workspace package compiler is reused as is: `exports`, with
   conditions walked in declaration order over `svelte`/`import`/`module`/`default`. It includes
   `./x/*` patterns and opaque entries for what cannot be followed. A package without `exports`
   resolves its bare name through its `svelte` field, and subpaths through its file layout. The
   `svelte`-field entry applies to workspace packages without `exports` too, since both are the
   same package shape.
5. **Symlinks are read through, not resolved.** Paths stay textual (`node_modules/@acme/ui/dist/…`),
   and `node:fs` follows pnpm's link on each read, exactly as Vite reads the file. `Runtime` has no
   `realpath`, and none is added. The link's destination is the installer's choice. With pnpm's
   global virtual store it is outside the repository by design. An `exports` target that leaves the
   package (`..`, absolute) stays refused, as for workspace packages.
6. **Only for head tags and headings.** The npm-widened list is a separate `Project.headAliases`,
   read by `resolveFileTags` (the route's composed head and its component headings) and by nothing
   else. The a11y composition, `correctness/each-key`'s imported lists, and the rules that resolve
   imports keep `componentAliases`/`kitAliases`. In them an npm component stays unfollowed, as
   before.
7. **Failure is local.** A package `.svelte` file that does not parse makes that component usage
   unfollowed, as if it had not been found, and the `metaComponents` fallback still applies. It never
   fails the run. An app's own malformed component still does (the existing contract).

## Precedence

Unchanged, and it needs no new code. Layer 2 (a known-library adapter, keyed on the import
specifier) runs before layer 3 (follow the file), and layer 4 (`metaComponents`) applies only when
layer 3 found nothing. So `svelte-meta-tags`, `svelte-seo` and `svead`
keep answering from the adapter even when the package is installed. A declared `metaComponents`
name becomes a no-op once the component is followed, as it already is for a local one.

## Why the bounds

- **Declared, not merely present.** `node_modules` holds the whole dependency tree. Only what the
  app declares is what its imports name.
- **Svelte packages only.** Without the filter, a 50-dependency app would add hundreds of entries to
  every specifier lookup. A component tag imported from a non-Svelte package would also make the
  walk parse that package's JS bundle. The cost: a Svelte library that publishes neither marker
  (against `svelte-package`'s defaults) is not followed.
- **Head and headings only.** That is where the measured false positives are, and what a user of
  such a library is missing. Letting a UI kit's internals into the a11y composition would close the
  world on routes where `no-missing-id-ref` and `required-element` now skip. It would also let
  `duplicate-landmark` and `id-duplication` report inside `node_modules`, a file the user cannot
  edit. None of that is measurable (see below), so it is not done.
- **The repository ceiling.** It is the same line the workspace resolver draws. Node's own walk goes
  to the filesystem root, but a `node_modules` above the repository is not the project's install.

## What is not followed

- **A package's own dependencies.** A followed package's import of another package resolves only
  when the app declares that package too (then the textual `node_modules/<dep>` exists). Otherwise it
  lives under `.pnpm/<pkg>@x/node_modules/` and is unreachable without `realpath`. Adapters need no
  resolution, so a package that renders `svelte-meta-tags` still gets that adapter. Per-importer
  resolution (a package's bare imports looked up from the package's own location) was rejected: the
  alias machinery has no notion of the importer. It would also widen the walk to the whole
  dependency tree.
- **Yarn Plug'n'Play**, which has no `node_modules`.
- **An uninstalled checkout.** Nothing is there to read, so behaviour is exactly as before.
  `metaComponents` remains the lever for that case, and for CI jobs that analyze before installing.

## Depth, breadth and I/O

- **Once per run, at collection:** one `exists` per ancestor for `.git`. Then, per declared name,
  one `exists` per `node_modules` level until one is found, and one read of each found manifest.
  N declared names cost at most N×levels `exists` and N reads. No glob.
- **During the walk:** only the files a route's composition actually renders are read, through the
  shared parse cache, so a package file is read and parsed at most once per run however many routes
  use it. A UI kit costs what its used components cost, not its size. The existing `MAX_DEPTH` and
  cycle guard bound the depth, and the re-export hop limit bounds barrels.
- `packages/cli/test/io-budget.test.ts`'s fixture declares an installed Svelte package whose
  component the root layout renders, so that path is held to the same per-file read cap and the
  "shared files are not read more as routes grow" check.

Measured on a synthetic worst case (a 400-component kit, three quarters of its components rendering
three others, and 150 routes that each render 25 of them), a run took about 4.5 s with the package
followed, against 0.9 s with it unfollowed. The same kit copied into `src/lib`, which the walk
already follows (including the a11y composition), took 6 to 9 s before this change. The cost is
therefore that of the existing per-route walk (fan-out bounded by `MAX_DEPTH`), not a new class. A
real installed app with one meta package (`svelte-meta-tags`, pnpm layout) ran in the same time
with and without the change.

## How it is verified

The corpus and holdout clones are **not installed**, so the corpus cannot measure this feature: its
numbers before and after are expected to be identical, and they will not reflect it. Verification is:

- In-memory fixtures with a `node_modules` tree: `exports` with the `svelte` condition, the
  `svelte` field, a hoisted `node_modules` above the app, an undeclared package, a non-Svelte
  package, a `node_modules` above the repository, a local-protocol dependency, adapter precedence,
  a package file that does not parse, and the a11y walk left unchanged.
- A real-filesystem test with pnpm's layout: `node_modules/<name>` a symlink into
  `node_modules/.pnpm/<name>@<v>/node_modules/<name>`, read through `createNodeRuntime()`.
- A manual check on an installed app on disk. It uses a copy of an installed real package, renamed
  so no adapter matches, and records the timing.
- The corpus run before and after, to confirm no change.

## Rejected alternatives

- **Following every declared dependency.** See "Svelte packages only".
- **Putting npm packages in `componentAliases`.** That is one list for everything, including the
  a11y walk and each-key. See "Head and headings only".
- **Resolving the link with a new `Runtime.realpath`**, to refuse targets outside the repository.
  Every adapter and the test runtime would need it. It would also refuse pnpm's global virtual store,
  which is a legitimate install, while guarding only against an `npm link` the user made themselves.
- **Probing lazily**, only for packages some component is actually imported from. The aliases are
  compiled once, before the walk, and are pure data in core. Feeding the walk's misses back into I/O
  would need a second resolution mechanism beside the alias list. The eager probe is at most one
  stat per declared name per level and one small JSON read.
- **Rewriting the reads to the package's source in the repository** (as for workspace packages).
  For an npm package, the installed `dist` is the only source there is.
