import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

const base = '/svelte-vitals';
const description =
  'A deterministic SvelteKit code-health scanner — SEO, performance, correctness, security, architecture.';

export default defineConfig({
  site: 'https://oekazuma.github.io/',
  base,
  integrations: [
    starlight({
      title: 'svelte-vitals',
      description,
      logo: { src: './src/assets/logo-mark.svg', alt: 'svelte-vitals' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/theme-image.css'],
      head: [{ tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: `${base}/favicon-180.png` } }],
      locales: {
        root: { label: 'English', lang: 'en' },
        ja: { label: '日本語', lang: 'ja' }
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/oekazuma/svelte-vitals' }],
      sidebar: [
        {
          label: 'Guides',
          translations: { ja: 'ガイド' },
          collapsed: true,
          items: [{ autogenerate: { directory: 'guides', collapsed: true } }]
        },
        {
          label: 'Rules',
          translations: { ja: 'ルール' },
          collapsed: true,
          items: [{ autogenerate: { directory: 'rules', collapsed: true } }]
        }
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: 'svelte-vitals',
          description
        })
      ]
    })
  ]
});
