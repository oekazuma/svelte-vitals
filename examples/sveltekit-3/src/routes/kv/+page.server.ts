import { kv } from '../../server/kv';
import { kv as outside } from '../../outside/kv';

export async function load() {
  await kv.set('visited', 'yes');
  // The control: reported, which shows the rule read this handler.
  await outside.set('visited', 'yes');
}
