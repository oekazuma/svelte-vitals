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
  deployment: {
    site: 'https://oekazuma.github.io',
    base: '/svelte-vitals'
  }
});
