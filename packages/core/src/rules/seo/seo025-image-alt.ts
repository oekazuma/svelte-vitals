import { imageRule } from '../perf/image-rule.js';

/**
 * SEO025 — Image alt text. Reuses the <img> collection from both providers — the
 * static (CLI) source parser and the rendered (vite) HTML parser — like PERF001/002.
 * Presence only: an explicit empty `alt=""` is a valid decorative-image signal and
 * passes; a spread `{...rest}` may supply alt, so it is not flagged.
 */
export const seo025ImageAlt = imageRule({
  id: 'SEO025',
  title: 'Image alt text',
  category: 'seo',
  severity: 'warning',
  label: '<img> alt text',
  recommendation: 'Add an alt attribute to every <img> (use alt="" only for purely decorative images).',
  rationale:
    'An <img> with no alt attribute is invisible to image search and assistive technology; a descriptive alt is an image-SEO signal.',
  fix: {
    description: 'Add a descriptive alt attribute to the <img> (or alt="" if purely decorative).',
    snippet: '<img src="/photo.jpg" width="800" height="600" alt="Description of the image" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasAlt
});
