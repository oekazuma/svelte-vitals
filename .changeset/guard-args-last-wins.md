---
'svelte-vitals': patch
---

Fix a boolean flag's last-wins resolution to see every `--flag=<value>` spelling, not just bare `--flag` and `--flag=false`. Previously `--flag=true --flag=false` left the flag on instead of turning it off, because the surviving `--flag=true` token reached the parser unnoticed.
