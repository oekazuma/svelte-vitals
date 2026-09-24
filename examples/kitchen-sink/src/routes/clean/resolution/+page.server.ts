import type { PageServerLoad } from './$types';

// The second request starts only when the first one's result asks for it, so the two cannot share a Promise.all.
export const load: PageServerLoad = async ({ fetch }) => {
  const user = (await fetch('/data/user.json').then((r) => r.json())) as { id?: number };
  const stats = user.id ? ((await fetch('/data/stats.json').then((r) => r.json())) as { views: number }) : null;
  return { compact: (stats?.views ?? 0) < 100 };
};
