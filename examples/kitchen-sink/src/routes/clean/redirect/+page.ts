// Redirect-only canary: the page never renders, so its empty +page.svelte (no <title>, no <h1>)
// must produce no route-level findings in either mode.
import { redirect } from '@sveltejs/kit';

export function load() {
  redirect(307, '/clean');
}
