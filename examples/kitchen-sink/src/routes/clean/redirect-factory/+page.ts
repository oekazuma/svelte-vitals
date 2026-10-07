// Redirect-only canary: an imported factory builds the load, and the function it returns always
// redirects, so the empty +page.svelte never renders and must produce no route-level findings.
import { createRedirect } from '$lib/clean/redirect/detail';

export const load = createRedirect('/clean');
