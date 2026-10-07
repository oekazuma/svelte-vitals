import { redirect } from '@sveltejs/kit';

/** A `load` that sends an old URL on to its new place. */
export function createRedirect(to: string) {
  return () => {
    redirect(307, to);
  };
}
