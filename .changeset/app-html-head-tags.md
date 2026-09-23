---
'svelte-vitals': patch
---

Source analysis now reads the literal `<title>`, `<meta name|property>` and `<link rel="canonical">` written in `src/app.html`'s `<head>`, which render on every route. A project that sets its title only in `app.html` was reported as missing it on every route (`seo/title-presence` critical); these tags now count as inherited by each route, and any `<svelte:head>` tag of the same kind in a layout or page, or a declared meta component, takes precedence. Tags holding a `%sveltekit.*%` placeholder are ignored, as are charset and viewport.

Because those tags now count, a shell title shared by every route is reported by `seo/duplicate-title` and `seo/title-length`, and a `<meta name="robots" content="noindex">` in `app.html` is reported by `seo/indexability` on every route.
