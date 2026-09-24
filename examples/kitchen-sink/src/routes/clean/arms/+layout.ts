import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ fetch }) => ({
  user: { name: 'Ada' } as { name: string } | null,
  stats: fetch('/data/stats.json').then((r) => r.json() as Promise<{ views: number }>)
});
