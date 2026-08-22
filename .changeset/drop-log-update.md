---
'svelte-vitals': patch
---

Drop the `log-update` dependency. The spinner, greeting, and score animation now repaint through a small in-house frame writer that counts wrapped rows and clips to the terminal height the same way, so narrow- and short-terminal behaviour is unchanged while the CLI's install pulls in 16 fewer packages.
