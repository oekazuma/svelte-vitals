// The second request reads ids a callback collected from the first one's result, so they cannot share a Promise.all.
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch }) => {
  const lists = (await fetch('/data/lists.json').then((r) => r.json())) as { items: string[] }[];
  const ids = new Set<string>();
  lists.forEach((list) => list.items.forEach((id) => ids.add(id)));
  const cards = (await fetch(`/data/cards.json?ids=${[...ids].join(',')}`).then((r) => r.json())) as string[];
  return { count: cards.length };
};
