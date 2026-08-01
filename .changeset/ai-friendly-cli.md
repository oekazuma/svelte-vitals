---
'svelte-vitals': minor
---

**The CLI now answers its own questions.** Two new read-only commands, and a pointer to them from
everywhere an agent is likely to look. Nothing about analysis changes.

### `svelte-vitals docs list` / `docs show <name>`

A curated set of guides — `output`, `config`, `scoping`, `ci`, `monorepo` — is bundled **inside
the CLI**. `docs list` prints each with a one-line description, `docs show <name>` prints one, and
`--json` gives the listing in machine-readable form.

```bash
npx svelte-vitals docs list
npx svelte-vitals docs show scoping
```

Because they ship with the binary, what you read always matches the version you are running and
works offline. The docs site remains the complete reference; this set is deliberately small and
written for a terminal.

### `svelte-vitals explain --list`

Prints every rule grouped by category, with its default severity and title. Previously the only
way to discover a rule id was to pass a wrong one and read the error — an accident, not an
affordance. `--list --json` gives `id`/`category`/`severity`/`title` per rule.

### Discovery pointers

- `--version` now prints a one-line pointer to `docs list` **on stderr**. stdout is unchanged —
  still exactly `<cli-version> (core <core-version>)` — so anything parsing it keeps working.
- `--help` gains an "If you are an AI agent" section naming the bundled docs, `--reporter agent`
  and `--reporter json`, `--diff`/`--staged`, `explain`, and the fact that exit `2` is never a
  pass and that the CLI never prompts when stdout is not a TTY.
- The generated Agent Skill's playbook now sends the agent to `docs list` for anything outside the
  rule catalog it already embeds. Re-run `npx svelte-vitals@latest install --refresh` to pick this
  up in an already-generated skill.

An agent is probabilistic about which surface it looks at, so the same route to the documentation
is worth repeating at every one of them.
