// File-write canary: `store.set()` calls the file store's own function, so it writes no module state.
import { json } from '@sveltejs/kit';
import { store } from '$lib/server/file-store';

export async function PATCH({ request }) {
  await store.set('settings', (await request.json()) as Record<string, string>);
  return json({ ok: true });
}
