import { defineConfig } from 'blume';

const description =
  "Your SvelteKit app's code health, checked before it ships. Statically, no browser — SEO, performance, correctness, security, architecture, accessibility.";

export default defineConfig({
  title: 'svelte-vitals',
  description,
  content: { root: 'src/content/docs' },
  logo: {
    image: { light: '/logo-mark.svg', dark: '/logo-mark.svg', alt: 'svelte-vitals' }
  },
  github: { owner: 'oekazuma', repo: 'svelte-vitals', dir: 'docs' },
  // Same three families Blume would fetch from Google Fonts, self-hosted so
  // `blume build` never depends on fonts.gstatic.com being consistent — its
  // file-hash rotations 404 mid-build and take CI down with them. Latin
  // subset only: Japanese text falls back to system fonts either way.
  theme: {
    fonts: {
      body: {
        name: 'Inter',
        variants: [{ src: 'fonts/inter-latin-var.woff2', weight: '400..700' }]
      },
      display: {
        name: 'Inter Tight',
        variants: [{ src: 'fonts/inter-tight-latin-var.woff2', weight: '400..700' }]
      },
      mono: {
        name: 'IBM Plex Mono',
        variants: [
          { src: 'fonts/ibm-plex-mono-latin-400.woff2', weight: 400 },
          { src: 'fonts/ibm-plex-mono-latin-500.woff2', weight: 500 },
          { src: 'fonts/ibm-plex-mono-latin-600.woff2', weight: 600 }
        ]
      }
    }
  },
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
