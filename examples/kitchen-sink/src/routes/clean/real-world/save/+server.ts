// `drafts.update(...)` calls the module's exported function; it is not a store write.
import * as drafts from '$lib/clean/real-world/drafts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const PUT: RequestHandler = async ({ request }) => {
  drafts.update('draft', await request.text());
  return new Response(null, { status: 204 });
};
