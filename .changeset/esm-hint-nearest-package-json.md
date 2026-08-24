---
'svelte-vitals': patch
---

Point the ESM config-load hint at the package.json nearest the config file. The old wording ("a CommonJS project needs \"type\": \"module\"") sent users to the project's package.json, which is the wrong file when a `--config` file lives outside the project tree — the scope that governs a config file is the nearest package.json above it.
