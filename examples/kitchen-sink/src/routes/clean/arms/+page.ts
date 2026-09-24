import type { PageLoad } from './$types';

// The layout load already started `stats`; awaiting it here starts no second request.
export const load: PageLoad = async ({ parent }) => {
  const { stats } = await parent();
  const { views } = await stats;
  return { views };
};
