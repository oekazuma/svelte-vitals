---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

`docs show <rule-id>` now tells you the id is a rule and points at `svelte-vitals explain <rule-id>` (which already prints a rule's rationale, options, and docs URL offline) instead of only listing the workflow guide topics. The agent report's intro now mentions `explain` too, so agents can reach rule semantics without the network.
