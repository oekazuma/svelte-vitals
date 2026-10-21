---
'svelte-vitals': patch
---

A component `{#if}` that one prop decides is now also decided when the use passes a ternary whose two arms each decide it alike (`<Modal title={editing ? 'Edit' : 'New'}>` for `{#if title}<h2>{title}</h2>{/if}`). The heading, id or landmark in that arm then counts on the route, so `seo/heading-level-skip` no longer reports the `<h3>` a modal's content opens with as skipping from the page's `<h1>`.
