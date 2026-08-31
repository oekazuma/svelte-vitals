---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Replace `tinyglobby` with Node's built-in `fs.glob`, dropping three production dependencies (`tinyglobby`, `fdir`, `picomatch`) from both packages. Results are still files only, dotfile-free, and POSIX-separated on every platform, and symlinks to files still match. Two behavior changes: symlinked directories are no longer traversed, and monorepo app discovery's depth cap now matches its design doc — configs at most 4 path segments deep are found (previously a drifted implementation reached one level deeper).
