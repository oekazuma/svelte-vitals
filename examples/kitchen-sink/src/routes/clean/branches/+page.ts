import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const posts = (await fetch('/data/posts-1.json').then((r) => r.json())) as { id: number; title: string }[];
  return { post: posts[0] };
};
