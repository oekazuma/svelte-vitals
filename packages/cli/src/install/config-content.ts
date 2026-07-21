/**
 * Generates the scaffolded `svelte-vitals.config.*` content for `svelte-vitals install`.
 * Unlike the agent-target generators in `skill-content.ts` (which digest the current rule
 * set into Markdown), this is a fixed template — every `Config` field, commented out, so a
 * user can uncomment what they need. See docs/src/content/docs/guides/configuration.mdx for
 * the authoritative option reference this mirrors.
 */
export function buildConfigFileTemplate(opts: { useDefineConfig?: boolean; useCommonJs?: boolean } = {}): string {
  const header = '// svelte-vitals config file — https://oekazuma.github.io/svelte-vitals/guides/configuration/\n';
  const options = `  // treatDynamicAs: 'pass', // 'pass' | 'warn' | 'fail' — how {data.title}-style dynamic values are scored
  // metaComponents: ['Seo'], // component names that resolve SEO tags into <head>
  // rules: {}, // e.g. { 'seo/title-presence': 'off' } to disable a rule
  // failOn: 'critical', // 'critical' | 'warning' | 'info'
  // weights: {} // e.g. { seo: 2 } — per-category weight for the combined Health score`;
  // .ts configs use defineConfig — it's the whole reason to pick .ts over .mjs (real
  // type-checking/autocomplete for the fields above). Note the import is a *runtime*
  // dependency: the caller must only pass useDefineConfig when svelte-vitals is actually
  // installed in the project (see config-file-format.ts's hasSvelteVitalsDependency).
  if (opts.useDefineConfig) {
    return `${header}import { defineConfig } from 'svelte-vitals';\n\nexport default defineConfig({\n${options}\n});\n`;
  }
  // A .js config in a project without "type": "module" is parsed as CommonJS by
  // loadConfigFile's import() — ESM `export default` there is a SyntaxError.
  if (opts.useCommonJs) {
    return `${header}module.exports = {\n${options}\n};\n`;
  }
  return `${header}export default {\n${options}\n};\n`;
}
