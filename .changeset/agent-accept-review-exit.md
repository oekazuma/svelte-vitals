---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

Stop the agent reporter from asking for an acceptance it just said was unreachable. A rule like `security/raw-html` reports a construct that survives its own fix — a sanitized `{@html}` is still an `{@html}` — and its `Fix:` line says so, while the `Accept:` line underneath asked for the rule to pass on re-run, sending an agent round the same edit twice. Findings that carry a line now name the other exit too: a reviewed `svelte-vitals-disable-next-line` comment above them. That line is also rendered — on the finding's heading and again where the directive has to go — so two findings of one rule in one file are no longer told apart only by their message, and so the directive lands on the right construct. Findings with no line to annotate (the `<head>` metadata rules) are unchanged.
