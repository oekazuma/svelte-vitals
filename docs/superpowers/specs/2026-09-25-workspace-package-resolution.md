# Workspace package resolution — design

**Date:** 2026-09-25
**Status:** approved
**Builds on:** `2026-07-30-kit-alias-resolution-design.md` (alias entries, first match wins, opaque
entries), and its "deliberately not solved" list, which leaves every path outside the analyzed
project unresolved.

## The problem

In a monorepo the app svelte-vitals analyzes (`apps/web`) often renders components from a package of
the same repository (`packages/ui`) that ships its source: `import MetaTags from
'@repo/ui/components/MetaTags.svelte'`. A bare specifier like that resolves to nothing today, so the
`<title>`, meta tags, JSON-LD and headings those components render are invisible to source analysis.
Every route then reads as missing them.

Measured on the 56-app corpus, this is the largest remaining false-positive class: 131 fp verdicts
across two apps. In one app the root layout mounts `MetaTags` from `@repo/ui` in `onMount` through
`import()`, so every client-rendered route reports a critical `seo/title-presence`. In the other,
`<Page.Title>` from `@cio/ui` renders each page's `<h1>`. That second app does not import the package
by name. Its `kit.alias` maps `@cio/ui/*` to `path.resolve('./node_modules/@cio/ui/src/*')`, a path
that exists only after an install, through the symlink the workspace install creates.

## What is followed

Component resolution (a route's `<head>` and headings, and correctness/each-key's imported constant
lists) resolves through `Project.componentAliases`: the project's alias list (`kitAliases`) widened
by the workspace packages the app declares. Both are compiled `KitAlias` entries, so the resolver is
unchanged: first match wins, and an opaque entry blocks.

1. **Which packages.** Only those the app's own `package.json` declares in `dependencies`,
   `devDependencies` or `peerDependencies` with a `workspace:` version range, or with a `link:`/`file:`
   path. A `workspace:` range that renames the package (`workspace:other@*`) or names a path is left
   out, because the specifier the app writes is then not the package's own name.
2. **Where they are.** From the analyzed directory upward, the nearest `pnpm-workspace.yaml`
   (`packages:`) or `package.json` with `workspaces` (an array, or `{ packages }`) is the workspace
   root. Its globs, minus `!` negations, are matched for `package.json` files, and a package is the
   one whose `name` equals the declared dependency. Two directories claiming one name are both
   dropped. The upward search stops at the directory holding `.git`, or at the filesystem root without
   one, and never goes further. A `link:`/`file:` path is followed only when a `.git` was found and the
   path stays below it.
3. **How a subpath resolves.** Through the package's `exports`, as Node reads it. A key without `*`
   matches exactly, and a `./x/*` key matches the directory's contents. Exact keys come first, then
   patterns by longest prefix. Conditions are walked in declaration order over
   `svelte`/`import`/`module`/`default`, which is `withPackageImports`' existing `importTarget`. A
   package that lists `svelte` first gets its source, and one that lists `import` first gets what it
   says, because that is what Vite picks. An entry this cannot follow stays in the list as an opaque
   entry, so a shorter pattern cannot answer in its place. That covers an environment condition
   (`browser`, `node`), a `null` exclusion, an array, a `*` in the middle of a pattern, and a target
   outside the package. A package without `exports` is read by its file layout (`name/x` →
   `<dir>/x`). That is the only fallback.
4. **A `kit.alias` into `node_modules/<package>`**, for a declared workspace package, names the
   package's directory instead. The workspace install makes that path a link to exactly that
   directory. Reading the directory directly gives the same file whether or not the checkout was
   installed. For an npm package in `node_modules`, the alias resolves as it did before.
5. **Inside a package**, relative imports between its files resolve even though they lie above the
   project root. Each entry carries the package directory as its `root`, and `resolveRepoLocalPath`
   accepts a path under a `root` the way it accepts one under a `kit.alias` directory above the root.
   A package importing itself by name (`@repo/ui/...` inside `@repo/ui`) resolves through the same
   entries, since Vite's resolution of a bare specifier does not depend on the importer here. For the
   same reason a package file's `$lib` or other alias specifier resolves through the _app's_ alias
   list: Vite's alias plugin applies to every file it transforms, workspace sources included. That is
   the bundler's answer, not a wrong one.

The entries come after the project's aliases and package `imports`, because Vite's alias plugin runs
before bare-specifier resolution.

## Why the bounds

The failure this spec avoids is the one `2026-07-30` names: a _wrong_ answer, meaning a real file that
is not the one the bundler imports. Each bound keeps a wrong answer out.

- **Declared, not merely present.** A package in the workspace that the app does not depend on is not
  what the app's import resolves to. Its specifier resolves from `node_modules`, or fails.
- **By `name`, not by directory.** `workspace:*` links the package whose `name` matches. The directory
  name is incidental.
- **`exports` before layout.** When `exports` exists, a path it does not export is not importable. The
  layout fallback would name a file Node refuses.
- **Only inside the repository.** A `link:`/`file:` path or a workspace glob that leaves the
  repository is refused. Nothing outside the repository is the project, and the analyzer should not
  read arbitrary directories because a package.json says so.

## What is not followed

- **npm packages in `node_modules`.** Their source is a build artifact of someone else's project. Rules
  about it are not actionable here, and reading it costs the I/O budget.
- **Rules that resolve imports** (`architecture/private-scope-import`, `architecture/route-component-import`,
  `security/shared-state-import`, `security/handler-state-write`). They keep reading `kitAliases`.
  Widening them is a separate decision, with its own measurement. `security/handler-state-write`
  would start reporting `.set()` on a workspace package's store, which may be right, but nothing
  measured it.
- **`workspace:` ranges that rename or name a path, npm-style plain version ranges across workspaces,
  and the `main`/`module`/`svelte` fields of a package without `exports`.** Each is rare in the
  corpus. A package without `exports` still resolves subpaths
  through its layout. The bare name resolves only to an `index` file.
- **`exports` patterns with a `*` that is not the last character** (`./icons/*.svelte`). Kept opaque
  (see above) rather than approximated.

## I/O

An app that declares no `workspace:`/`link:`/`file:` dependency makes no extra Runtime call. The app's
`package.json` is the source `detectKitConfigFacts` already read. Otherwise the lookup costs, once per
run:

- up to three `exists` calls per ancestor directory, plus a read of each ancestor's `package.json` that exists,
- one glob per workspace pattern,
- one read of each matched `package.json`.

Each file is read once, which keeps it within `packages/cli/test/io-budget.test.ts`'s per-file cap. The
budget test's fixture declares no local dependency, so its numbers do not move.
`packages/cli/test/workspace-packages.test.ts` asserts that such an app touches nothing above its
root.

Matches under `node_modules` are dropped. A `**` workspace glob still walks into a package's own
`node_modules` on an installed checkout, where pnpm's entries are symlinks that the Node runtime's glob
does not descend. The corpus clones are not installed, so that traversal cost is unmeasured.

The upward search has a depth limit (32 levels). A real filesystem reaches its root long before that.
The limit only bounds a runtime whose `join` never reaches a fixed point, such as the in-memory test
runtime.

## Rejected alternatives

- **Resolving through `node_modules` on disk.** It needs an installed checkout, reads whatever version
  is installed rather than the source in the repository, and would open the door to npm packages.
  Rewriting `node_modules/<workspace package>` to the package directory gives the installed answer
  without the install.
- **A separate resolver for bare specifiers in the CLI's component walk.** The alias machinery already
  encodes first-match precedence, opaque entries, and above-root reads. `withPackageImports` already
  compiles a package.json field into entries. A second mechanism would need all of that again, and
  the two could disagree.
- **Widening `kitAliases` itself.** One list for everything would change two default-on security rules
  as a side effect, with no measurement behind the change.
- **A YAML dependency for `pnpm-workspace.yaml`.** `packages:` is a list of globs. A small line reader
  covers the block and flow forms without moving `dep-budget.test.ts`.
