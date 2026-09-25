// `database` is a facade spread from imported modules, not an in-memory store of its own.
import { database } from '$lib/server/database';
import type { RequestHandler } from './$types';

export const prerender = false;

export const PUT: RequestHandler = async ({ request }) => {
  database.drafts.update('draft', await request.text());
  return new Response(database.notify('draft saved'));
};
