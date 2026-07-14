/**
 * Generates the scaffolded `svelte-vitals.config.mjs` content for `svelte-vitals install`.
 * Unlike the agent-target generators in `skill-content.ts` (which digest the current rule
 * set into Markdown), this is a fixed template — every `Config` field, commented out, so a
 * user can uncomment what they need. See docs/src/content/docs/guides/configuration.md for
 * the authoritative option reference this mirrors.
 */
export function buildConfigFileTemplate(): string {
  return `// svelte-vitals config file — https://oekazuma.github.io/svelte-vitals/guides/configuration/
export default {
  // treatDynamicAs: 'pass', // 'pass' | 'warn' | 'fail' — how {data.title}-style dynamic values are scored
  // metaComponents: ['Seo'], // component names that resolve SEO tags into <head>
  // rules: {}, // e.g. { SEO001: 'off' } to disable a rule
  // failOn: 'critical', // 'critical' | 'warning' | 'info'
  // weights: {} // e.g. { seo: 2 } — per-category weight for the combined Health score
};
`;
}
