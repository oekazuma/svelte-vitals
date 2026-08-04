---
'svelte-vitals': patch
---

A large report is no longer truncated when the CLI's output is piped.

`svelte-vitals --reporter json` writes the report and then exits, and a write to a pipe is asynchronous — so
anything past the first buffer, 65,536 bytes on Linux and macOS, was discarded. The exit code was unaffected,
so a consumer saw a successful run and a payload cut mid-string. Any project whose report exceeds that size
was affected, and `--reporter html` written to stdout the same way.

The CLI now waits for stdout to drain before exiting. Piping to `jq`, to a file through a shell, or into
another process delivers the whole report.
