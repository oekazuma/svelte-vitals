import { defineConfig } from 'blume';

const description =
  'A deterministic SvelteKit code-health scanner — SEO, performance, correctness, security, architecture.';

export default defineConfig({
  title: 'svelte-vitals',
  description,
  content: { root: 'src/content/docs' },
  logo: {
    image: { light: '/logo-mark.svg', dark: '/logo-mark.svg', alt: 'svelte-vitals' }
  },
  github: { owner: 'oekazuma', repo: 'svelte-vitals', dir: 'docs' },
  // Blume shows the "Was this page helpful?" widget by default, but its vote goes to
  // whichever provider `analytics` configures — and we configure none, so a click was
  // discarded while still thanking the reader for it.
  feedback: false,
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' }
    ]
  },
  // The MCP server guide was deleted when `@svelte-vitals/mcp` was removed
  // (docs/superpowers/specs/2026-08-01-remove-mcp-design.md). Its URL is still in
  // search results and in the READMEs of already-published npm versions, so send
  // those readers to the install guide, which carries the migration note, rather
  // than to a 404.
  redirects: [
    { from: '/guides/mcp', to: '/guides/install' },
    { from: '/ja/guides/mcp', to: '/ja/guides/install' }
  ],
  deployment: {
    site: 'https://oekazuma.github.io',
    base: '/svelte-vitals'
  }
});
