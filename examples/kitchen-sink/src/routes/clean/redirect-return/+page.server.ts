// Redirect-only canary: both paths end in `return redirect(…)`, which throws, so the empty
// +page.svelte never renders and must produce no route-level findings.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  if (!cookies.get('session')) {
    return redirect(303, '/clean');
  }
  try {
    cookies.delete('session', { path: '/' });
  } catch (err) {
    console.error(err);
  }
  return redirect(303, '/clean');
};
