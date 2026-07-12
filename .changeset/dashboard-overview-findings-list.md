---
'@svelte-vitals/vite': patch
---

Live dashboard: the "Overview" pane now lists every finding across the whole project (all routes plus site-wide checks) instead of only site-wide checks, and the severity/category filter chips actually filter that list. Previously the chips rendered on Overview but had nothing to act on for most projects (no site-wide findings), which made them look broken. Each finding now shows its route, clickable to jump straight to that route's detail pane.
