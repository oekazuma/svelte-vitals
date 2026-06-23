import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://oekazuma.github.io/',
  base: '/svelte-vitals',
  integrations: [
    starlight({
      title: 'svelte-vitals',
      description: 'A SvelteKit SEO & Performance checker — static analysis of your routes, before they ship.',
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
      ]
    })
  ]
});
