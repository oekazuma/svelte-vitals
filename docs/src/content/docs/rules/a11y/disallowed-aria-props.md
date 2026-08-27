---
title: a11y/disallowed-aria-props · ARIA attribute not allowed on this role
description: An aria-* attribute the element's role does not support is ignored; one the role prohibits — a name on a bare div — is a name that is not exposed.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags an `aria-*` attribute that the element's role either **prohibits** or **does not own**, judged against the ARIA 1.3 role tables in component source.

Which role is judged:

- An explicit `role` — its first concrete token, as a browser resolves `role="switch checkbox"`. A role ARIA does not define is `a11y/invalid-role`'s finding, not this one; a DPUB-ARIA role (`doc-toc`, …) gets no judgment, since the role tables this rule reads do not cover DPUB.
- Otherwise the element's implicit role — and, for the elements whose implicit role depends on context (`<a>` is `link` only with `href`, `<img alt="">` is `presentation`, `<input>` is whatever its `type` says), **every role the element could have**. A judgment is made only when it holds under all of them. So `<div aria-label>` fires (a `<div>` is `generic` everywhere, and `generic` does not take a name), while `<a aria-label>`, `<img aria-label>` and `<input aria-checked>` do not. `<input>` is effectively unjudgeable for any non-global attribute here; the Svelte compiler's `a11y_role_supports_aria_props_implicit` covers `<input type="text" aria-checked>`.
- An expression role, or a spread with no literal role, leaves the role unknowable: no finding.

Two kinds of finding, with different messages:

- Prohibited — `aria-label`, `aria-labelledby` or `aria-braillelabel` on an element whose role does not take a name (`<div>`, `<span>`, `<p>`, `<code>`, `<label>`, `<time>`, …), or any attribute a role's table lists as prohibited (`aria-roledescription` on `generic`). Message: "`aria-label` is prohibited on `<div>` — its role does not take a name".
- Not supported — an attribute absent from the role's table: `aria-checked` on `role="button"`, `aria-level` on a `<span>`. Message: "`aria-level` is not supported by role `generic`".

```svelte
<div aria-label="Breadcrumb">Home / Gallery</div>

<div role="button" tabindex="0" aria-checked="true">Toggle</div>
```

Not flagged:

- An attribute `a11y/unknown-aria-attribute` already reports — one typo, one finding.
- The (role, attribute) pairs the ARIA 1.3 tables no longer list but the Svelte compiler's data still accepts (`aria-level` on `listitem`, `aria-expanded` on `listbox`, …). Where the compiler and this rule would disagree on the same markup, the compiler wins.
- `<address aria-label>` and `<hgroup aria-label>`: the dataset marks both as not taking a name, but the ARIA-in-HTML specification and axe give both `role=group`, which does. This rule follows the specification.
- Anything a value could fix (`a11y/invalid-aria-value`) or a missing required attribute (`a11y/required-aria-props`).

**Overlap with the Svelte compiler.** For explicit roles and the implicit roles the compiler maps, `a11y_role_supports_aria_props` / `_implicit` report the _not supported_ case too, and this rule agrees with it. The compiler is silent on the _prohibited_ case — `<div aria-label>` compiles without a warning — which is the case that appears in real code.

**Where axe differs.** axe's `aria-prohibited-attr` grades a prohibited name as _needs review_ when the element has text content and _serious_ only when it does not, and exempts a name whose nearest ancestor role is a widget. This rule reports all of them: ARIA prohibits the attribute on the role regardless of what else names the element. `<label>` is the one to know about — the specification prohibits a name on it only when it is exposed as `generic`; the dataset and axe both prohibit it unconditionally, and `<label for=… aria-label="close sidebar">` will fire.

## Why it matters

An unsupported `aria-*` attribute is dropped by assistive technology, so the state the author meant to convey is not conveyed. A prohibited one is worse: `aria-label` on a bare `<div>` looks, in the source, like a labelled region, and screen readers announce nothing for it — the label exists only in the author's mental model.

## How to fix

Give the element a role that supports the attribute, or move the attribute to the element that owns the semantics:

```svelte
<nav aria-label="Breadcrumb">Home / Gallery</nav>

<div role="switch" tabindex="0" aria-checked="true">Toggle</div>
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single element with `<!-- svelte-vitals-disable-next-line a11y/disallowed-aria-props -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-aria-props': 'off'
  }
};
```
