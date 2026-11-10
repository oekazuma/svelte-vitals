import { kv } from '../../server/kv';

export async function load() {
  await kv.set('visited', 'yes');
}
