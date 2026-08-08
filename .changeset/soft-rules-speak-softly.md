---
'@svelte-vitals/core': patch
---

Softened overstated or stale claims in several rules' rationale text (and one fix snippet), following the 2026-08-09 rule-validity review's Priority-3 findings. Wording only — no detection, severity, or message changes.

- `performance/image-dimensions`: "triggers CLS" → "can trigger … unless the box is reserved another way (e.g. CSS `aspect-ratio`)".
- `security/javascript-url`: leads with the CSP violation and unsafe navigation instead of XSS, demotes XSS to a parenthetical (detection is literal-only, so every flagged URL is author-written), and adds `formaction` to the attribute list already covered by detection.
- `seo/canonical-url`: drops the trailing-slash example — SvelteKit normalizes those by default.
- `seo/heading-level-skip`: assistive tech "relies on" the document outline; search engines now only "use it as a structural signal" rather than "rely on" it.
- `seo/html-lang`: drops the "for search engines" framing — Google has said it does not use `lang` for ranking — in favor of screen readers, translation, and other assistive handling.
- `seo/image-alt`: the fix snippet's placeholder alt text (`"Description of the image"`) tripped Svelte's own `a11y_img_redundant_alt` check; replaced with a concrete example.
- `seo/viewport`: drops the unsupported "Google penalizes" claim for the documented ~980px layout-viewport rendering behavior mobile browsers fall back to.
