// Error-only layout canary: load throws on every call, so no page under it renders, and they must
// produce no route-level findings. Not prerendered: a prerendered error fails the build.
import { error } from '@sveltejs/kit';

export const prerender = false;

export function load(): { section: string } {
  error(404, 'This section is not available yet.');
}
