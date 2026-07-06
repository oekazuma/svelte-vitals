import type { Config } from '@svelte-vitals/core';

/** TypeScript config file — exercises native type-stripping (see design doc §2). */
const config: Partial<Config> = {
  failOn: 'warning',
  treatDynamicAs: 'fail'
};

export default config;
