---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Replace `tinyglobby` with Node's built-in `fs.glob`, dropping three production dependencies (`tinyglobby`, `fdir`, `picomatch`) from both packages. Glob behavior is unchanged: results are still files only, dotfile-free, and POSIX-separated on every platform.
