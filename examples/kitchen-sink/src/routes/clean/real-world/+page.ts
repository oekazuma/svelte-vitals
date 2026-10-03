import type { PageLoad } from './$types';

const cache = { ready: Promise.resolve() };

// Awaiting a promise that already exists starts no request, so it is not a sequential await.
export const load: PageLoad = async ({ fetch }) => {
  const [statsRes, configRes] = await Promise.all([fetch('/data/stats.json'), fetch('/data/config.json')]);
  await cache.ready;
  const [stats, config] = (await Promise.all([statsRes.json(), configRes.json()])) as Record<string, unknown>[];
  return { stats, config };
};
