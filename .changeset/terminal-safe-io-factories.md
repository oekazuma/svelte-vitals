---
'svelte-vitals': patch
---

Sanitize terminal escape sequences from analyzed-repo strings that reach the terminal outside the analyze report: every subcommand's stderr (`consoleIO.errorLog`), the `install` command's stdout/stderr and its `runCommand` failure messages, and the CLI's last-resort error path. The `analyze` command's own stdout is unchanged — its console reporter already sanitizes tainted substrings at interpolation points and still emits its own deliberate ANSI color codes.
