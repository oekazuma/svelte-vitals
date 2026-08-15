import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  // performance/load-waterfall: `posts` depends on `user.id` — a second client
  // round trip that could run server-side instead.
  const user = await fetch('/data/user.json').then((r) => r.json());
  const posts = await fetch(`/data/posts-${user.id}.json`).then((r) => r.json());

  // performance/sequential-awaits: `config` and `stats` don't depend on anything
  // above or each other — awaited back to back for no data-flow reason.
  const config = await fetch('/data/config.json').then((r) => r.json());
  const stats = await fetch('/data/stats.json').then((r) => r.json());

  return { user, posts, config, stats };
};
