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
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' }
    ]
  },
  deployment: {
    site: 'https://oekazuma.github.io',
    base: '/svelte-vitals'
  }
});
