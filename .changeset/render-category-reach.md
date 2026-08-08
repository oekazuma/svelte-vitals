---
'@svelte-vitals/core': minor
---

The HTML report and the dev dashboard now show each category's reach ("N of M keys affected") beside its score. The score floor design (2026-08-05) moved magnitude out of the score and into `categories[cat].affectedKeys`/`keys`, so a reader could no longer tell one affected file from forty-one — both surfaces received the fields and rendered nothing. Per-route category rendering (`routes[].categories`) remains a deferred, separate question.
