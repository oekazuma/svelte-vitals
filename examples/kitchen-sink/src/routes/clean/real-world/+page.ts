import type { PageLoad } from './$types';

const cache = { ready: Promise.resolve() };

// Awaiting a promise that already exists starts no request, so it is not a sequential await.
export const load: PageLoad = async ({ fetch }) => {
  const stats = (await fetch('/data/stats.json').then((r) => r.json())) as Record<string, unknown>;
  await cache.ready;
  return { stats };
};
