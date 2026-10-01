// Flag-gated canary: the load redirects while an imported flag is the literal false, so the page
// never renders and its empty +page.svelte (no <title>, no <h1>) must produce no route-level findings.
import { redirect } from '@sveltejs/kit';
import { BETA_INBOX } from '$lib/clean/flags/features';

export const prerender = false;

export function load() {
  if (!BETA_INBOX) redirect(307, '/clean');
  return {};
}
