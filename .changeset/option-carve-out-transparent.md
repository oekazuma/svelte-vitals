---
'svelte-vitals': patch
---

`a11y/permitted-contents` no longer reports content that only `<option>` or `<optgroup>` rejects when it sits inside a transparent element there. `<option><a href="/x"><span>y</span></a></option>` reported the `<span>`, though `<option><span>y</span></option>` was not reported, because the Svelte compiler allows rich `<option>` content. A child that a non-transparent element inside `<option>` rejects, such as a `<div>` in a `<b>`, is still reported.
