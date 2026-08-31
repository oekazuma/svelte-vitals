---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Replace `tinyglobby` with Node's built-in `fs.glob`, dropping three production dependencies (`tinyglobby`, `fdir`, `picomatch`) from both packages. Results are still files only, dotfile-free, and POSIX-separated on every platform, and symlinks to files still match. One behavior change: symlinked directories are no longer traversed.
