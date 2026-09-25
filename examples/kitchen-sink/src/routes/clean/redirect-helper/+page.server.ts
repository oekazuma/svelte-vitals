// Redirect-only canary: load reaches every redirect through a same-file helper, so the empty
// +page.svelte never renders and must produce no route-level findings in either mode.
import { isRedirect, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

async function finishSignIn(fetch: typeof globalThis.fetch) {
  const res = await fetch('/data/user.json');
  if (!res.ok) throw new Error(`session lookup failed: ${res.status}`);
  redirect(303, '/clean');
}

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    await finishSignIn(fetch);
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(303, '/');
  }
};
