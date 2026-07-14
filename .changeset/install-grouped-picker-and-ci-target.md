---
'svelte-vitals': minor
---

`svelte-vitals install`'s interactive picker now groups targets by category — MCP server, Vite integration, Agent Skills & rules, CI (GitHub Actions), Config file — instead of one flat list, making it easier to tell what each of the ten targets is for. The GitHub Actions workflow (previously only available via the standalone `svelte-vitals ci install`) is now also a selectable `ci-workflow` target inside `install`, so CI can be set up in the same pass as the MCP server/Vite/skills instead of a separate command. `svelte-vitals ci install`/`ci upgrade` remain available standalone.
