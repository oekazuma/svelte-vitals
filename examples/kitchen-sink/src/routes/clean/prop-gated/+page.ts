// The store write sits after a browser-only early return, so the server never shares it across requests.
import { browser } from '$app/environment';
import { lastVisited } from '$lib/clean/prop-gated/visits';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  if (!browser) return {};
  lastVisited.set(url.pathname);
  return {};
};
