// seo/canonical-url and seo/description-presence report as info here: the load sends a visitor
// without a session to the login page, so a crawler never sees this page. Not prerendered: a
// prerender has no session and would bake out the redirect.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) redirect(303, '/');
  return { name: locals.user.name };
};
