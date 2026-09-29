import { db, items } from '$lib/clean/db-write/db';

export async function POST() {
  await db.update(items).set({ archived: true });
  return new Response(null, { status: 204 });
}
