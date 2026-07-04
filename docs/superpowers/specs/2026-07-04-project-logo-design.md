# Project logo — design

## Goal

svelte-vitals has no visual identity yet (no logo, no favicon). Add one that reads as "Svelte" at a glance while signaling the project's actual pitch: vital-sign-style static diagnostics for a SvelteKit app.

## Concept

A rounded-square icon mark in Svelte's official orange (`#FF3E00`, confirmed against `sveltejs/branding`'s `svelte-logo.svg`), with a white EKG/heartbeat polyline crossing through the middle (P-wave bump, sharp QRS spike, T-wave bump, on a flat baseline).

The rounded-square "frame" is an original shape, not a trace of Svelte's official mark — `sveltejs/branding`'s usage terms say the logo must not imply endorsement/sponsorship by the Svelte project, so only the official brand color is reused, not the registered artwork's path data.

## Deliverables

| File                                                                          | Purpose                                                                                                                                         |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/logo-mark.svg`                                                        | Icon-only mark (rounded square + pulse). Source of truth; copied to the two locations below.                                                    |
| `docs/src/assets/logo-mark.svg`                                               | Same file, for Starlight's `logo.src` (header logo).                                                                                            |
| `docs/public/favicon.svg`                                                     | Same file, for Starlight's `favicon`.                                                                                                           |
| `docs/public/favicon-32.png`, `docs/public/favicon-180.png`                   | Raster fallbacks (browser tab icon, iOS apple-touch-icon), rasterized from the mark via `sharp` (already a `docs` dependency) — not hand-drawn. |
| `assets/wordmark-light.svg`                                                   | Icon + "svelte-vitals" text, dark text — for README on light backgrounds.                                                                       |
| `assets/wordmark-dark.svg`                                                    | Same lockup, light text — for README on dark backgrounds (GitHub dark theme).                                                                   |
| `assets/social-banner.svg` + rasterized `assets/social-banner.png` (1200×630) | Wordmark + one-line category tagline on a dark background, sized for GitHub's repo "Social preview" and general link-preview use.               |

## Integration

- `docs/astro.config.mjs`: add `logo: { src: './src/assets/logo-mark.svg', alt: 'svelte-vitals' }` and `favicon: '/favicon.svg'` to the `starlight()` config, plus a `head` entry linking `favicon-180.png` as `apple-touch-icon`.
- `README.md`: replace the plain `# svelte-vitals` heading with a centered `<picture>` that swaps `wordmark-dark.svg`/`wordmark-light.svg` on `prefers-color-scheme`, badges centered underneath.

## Known limitation

`social-banner.png` is provided as a file in the repo; GitHub's actual repo-level "Social preview" card is a manual upload under Settings → General → Social preview and can't be set from a commit. This will be called out to the user as a manual follow-up step.

## Out of scope

- Animating the pulse line (kept static for now; a `stroke-dasharray` animation could be layered on later without changing the shape).
- npm does not use an OG-image on the package page, so `social-banner.png` targets GitHub/link previews only.
