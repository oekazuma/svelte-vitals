// Redirect-only canary: the page never renders, so its empty +page.svelte (no <title>, no <h1>)
// must produce no route-level findings in either mode — though the redirect sits in if/else arms and a catch.
import { isRedirect, redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  try {
    const res = await fetch('/data/user.json');
    if (res.ok) redirect(307, '/clean');
    else redirect(307, '/');
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(307, '/');
  }
};
