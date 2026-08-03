---
title: architecture/doc-link-target · Documentation link target
description: A documentation link written in a comment must still point at something that exists.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a Markdown link inside a component comment whose target no longer exists — when that link's URL sits
under a prefix you have declared as standing for your project root.

This rule is **off until you configure it**: it cannot guess which URLs on the internet correspond to paths
in your repository.

## Why it matters

A link written in a comment has nothing to resolve it. No type refers to it, no module imports it, and no
test renders it, so a rename that moves its target leaves it silently broken — reachable only by clicking
it. A reorganisation that renames many units can break every such link at once.

## How to fix

Point the link at the unit that exists now, or remove it.

## Configuration

| Option     | Type          | Default |
| ---------- | ------------- | ------- |
| `urlRoots` | `string-list` | `[]`    |

Each entry is a **URL prefix that stands for this project's root**. A link whose URL starts with one has
that prefix stripped, and the remainder is looked up among the files under `src/`.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/doc-link-target': {
      options: { urlRoots: ['https://example.test/components/packages/ui/'] }
    }
  }
};
```

Declare the whole prefix, including any workspace directories your published URL happens to contain — that
part varies with your publishing scheme, so it cannot be derived from where the analysis runs.

The longest matching entry wins, so a broad prefix and a narrower one can coexist. Entries **add** to the
list rather than replacing it, which is how a project reachable under a second host (a staging deployment,
say) declares both.

## Not reported

- A URL under no declared prefix — an external link, a documentation slug, a `mailto:`. The declaration is
  what makes something a reference; the shape of the target never is.
- A remainder that doesn't start with `src/` — a `CONTRIBUTING.md` or `static/logo.svg` at the project root,
  for instance. The file inventory only covers `src/`, so it has no opinion outside that tree, and reporting
  "absent" there would mean "unindexed", not "missing".
- A link outside a comment. Rendered markup is content.
- A relative link, or a link in a `.md` file. This rule reads component comments only.
- A trailing `// [label](url)` comment on a line of code. `//` counts as a comment opener only at the start
  of a line, which is what keeps the scan out of the `//` in `https://`.
- A link inside a `/* … */` block comment or a `/** … */` JSDoc comment in a script. Only the markup form
  (`<!-- … -->`) and a line-leading `//` are scanned.

## Limitations

Renaming the unit a link points at, in a file the link itself doesn't live in, is invisible to `--diff` /
`--staged`: a finding's `location` is the file holding the link, and there is no better one to use — the
target that moved is not the file that changed. A full run still reports it.
