---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Analysis no longer slows down quadratically on very large source files. Every recorded line number was computed by counting newlines from the start of the file, so a project with generated components of a few megabytes each took minutes, and one did not finish within a CI job's time limit; line numbers now come from a per-file index, and that project is analyzed in seconds. Reported lines are unchanged.
