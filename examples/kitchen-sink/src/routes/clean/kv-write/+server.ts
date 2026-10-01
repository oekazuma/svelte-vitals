// KV-write canary: `kv` is a client for an external store, so its `.set()` writes no module state.
import { json } from '@sveltejs/kit';
import { kv } from '$lib/clean/kv/client';

export async function PATCH({ request }) {
  await kv.set('settings', await request.json());
  return json({ ok: true });
}
