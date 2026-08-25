---
title: correctness/autoplay-muted · Autoplay video without muted
description: 'Browsers block autoplay with audio, and a blocked autoplay does not error — a <video autoplay> without muted silently never starts playing for real visitors.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a `<video>` element that carries a literal `autoplay` attribute but no `muted` attribute:

```svelte
<video autoplay src="/hero.mp4"></video>
```

`autoplay` is an HTML boolean attribute — its presence is what autoplays, so any literal value counts (`autoplay="false"` still autoplays). An expression-valued `autoplay={expr}` is unknowable statically and is not flagged. `muted` in any form passes: a bare `muted`, `muted={expr}` (the expression could be true), `bind:muted`, or a spread attribute that could supply it.

## Why it matters

Chrome and Safari block autoplay with audio: `autoplay` is only honoured when the video is muted or the site has earned an autoplay allowance. A blocked autoplay does not throw — the video just never starts.

One documented exception: both browsers may allow unmuted autoplay for a video that has no audio track at all. A silent hero video without `muted` can therefore work — the finding is still worth acting on, since `muted` is harmless there and makes the intent explicit, but it is advisory in that case rather than a guaranteed failure.

This makes the defect invisible in development: after interacting with the page, autoplay is often allowed for the session, so the author sees the video play and ships it. Real visitors get a frozen poster frame. The markup looks correct, compiles, and silently does nothing — exactly the class of defect static analysis is for.

## How to fix

Add `muted`, and typically `playsinline` so iOS plays the video inline instead of refusing or going fullscreen:

```svelte
<video autoplay muted playsinline src="/hero.mp4"></video>
```

If the video genuinely needs sound, drop `autoplay` and start playback from a user gesture instead.

## Limitations

Only native `<video>` elements with a literal `autoplay` are covered. An expression-valued `autoplay` is unknowable and is not flagged, and a dynamic tag via `<svelte:element this="video">` is not inspected — the same RegularElement-only convention as `correctness/checkable-bind-value`. `<audio autoplay>` is out of scope: a muted audio autoplay is meaningless, so the rule's recommendation does not transfer — an audible `<audio autoplay>` is blocked the same way but needs a different fix (start playback from a user gesture). `muted={expr}` passes without evaluating the expression, so a hardcoded `muted={false}` is not flagged.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/autoplay-muted': 'off'
  }
};
```
