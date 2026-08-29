---
'@svelte-vitals/core': patch
---

Strip C1 control characters (U+0080–U+009F) in `terminalSafe`.

The function already removed ESC-form (`\x1b[`/`\x1b]`) OSC/CSI sequences and C0 control
bytes, but let C1 control bytes through untouched. C1 has single-codepoint equivalents for
CSI (U+009B), OSC (U+009D), and ST (U+009C) that legacy or some configured terminals
interpret the same as their two-byte ESC forms, so a repo path or route id containing one
of these bytes could still smuggle a terminal-title rewrite or cursor/screen control
sequence into a rendered report. `terminalSafe` now matches C1 CSI/OSC sequences (and OSC's
C1 ST terminator) alongside their ESC-form counterparts, and the final control-byte sweep
now also drops any other lone C1 byte.
