// Error-only canary: load throws on every call, so the route renders its error page, never this
// one, and must produce no route-level findings. Not prerendered: a prerendered error fails the build.
import { error } from '@sveltejs/kit';

export const prerender = false;

export function load() {
  error(503, 'This page is under maintenance.');
}
