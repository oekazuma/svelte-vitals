import { imageRule } from './image-rule.js';

export const performanceResponsiveImage = imageRule({
  id: 'performance/responsive-image',
  title: 'Responsive image',
  severity: 'info',
  label: '<img> srcset',
  recommendation: 'Provide a srcset (and sizes) so the browser can pick a right-sized image per viewport.',
  rationale:
    'An <img> without srcset ships one fixed-size asset to every device, wasting bytes on small screens. Static analysis cannot measure intended display size, so this is advisory.',
  fix: {
    description: 'Add a srcset (and sizes) to the <img> for responsive delivery.',
    snippet:
      '<img src="/hero.jpg" srcset="/hero-800.jpg 800w, /hero-1600.jpg 1600w" sizes="100vw" width="1600" height="900" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasSrcset
});
