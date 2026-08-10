---
'svelte-vitals': minor
---

The agent reporter's auto-selection now recognizes the major AI-agent harnesses (Cursor, Codex, Replit, and others alongside Claude Code) by delegating detection to gunshi's agent profile (std-env) instead of a two-entry allow-list. Agents that previously received console output will now get the agent reporter automatically; an explicit `--reporter` flag or `SVELTE_VITALS_REPORTER` still overrides, and `SVELTE_VITALS_AGENT=1` remains the universal opt-in for unrecognized harnesses. The recognized-agent list evolves with gunshi updates.
