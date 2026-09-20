---
'svelte-vitals': patch
---

The static a11y walk now resolves a `<svelte:element>` whose `this` is a string literal, or a conditional whose branches are both literals, to the element(s) it renders, and credits them to the route's element set. Such an element previously left the set open whatever its `this`, which made `a11y/required-element` skip the route rather than report a missing element. A `this` that still cannot be resolved keeps the old, conservative behaviour.
