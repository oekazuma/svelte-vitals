// `session.initialize()` fills `session.user`, so the second request needs the first and cannot share a Promise.all.
import { createSession } from '$lib/clean/session';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch }) => {
  const session = createSession(fetch);
  await session.initialize();
  const greeting = (await fetch(`/data/greeting.json?name=${session.user?.name ?? ''}`).then((r) => r.json())) as {
    text: string;
  };
  return { greeting: greeting.text };
};
