import { componentRule } from '../component-rule.js';

/**
 * correctness/autoplay-muted — Chrome and Safari block autoplay with audio, and a blocked
 * `<video autoplay>` does not error: it silently never starts. The author sees it work in dev
 * (after interacting with the page, autoplay is often allowed for the session) and ships a
 * video that stays frozen for real visitors. `muted` in any form (bare, `muted={expr}`,
 * `bind:muted`, spread) passes — expression values are not evaluated, per issue #580's scope —
 * and only a literal `autoplay` counts.
 */
export const correctnessAutoplayMuted = componentRule({
  id: 'correctness/autoplay-muted',
  title: 'Autoplay video without muted',
  category: 'correctness',
  severity: 'warning',
  label: 'Muted autoplay videos',
  recommendation:
    'Add `muted` to every `<video autoplay>` (and typically `playsinline`, so iOS plays it inline instead of refusing or going fullscreen).',
  rationale:
    'Browser autoplay policies block autoplay with audio: Chrome and Safari only honour `autoplay` when the video is muted (or the site has earned an autoplay allowance; a video with no audio track may also be allowed). A blocked autoplay does not throw — the video just never starts, so the page ships with a frozen poster frame for real visitors while working in development, where prior interaction often unlocks autoplay for the session. Adding `muted` is harmless even where autoplay would have been allowed.',
  fix: {
    description: 'Add the muted attribute (and typically playsinline) to the autoplaying video.',
    snippet: '<video autoplay muted playsinline src="/hero.mp4"></video>',
    lang: 'svelte'
  },
  applies: (c) => (c.videosAutoplayNoMuted ?? []).length > 0,
  bad: (c) =>
    (c.videosAutoplayNoMuted ?? []).map((f) => ({
      line: f.line,
      message:
        '<video autoplay> without muted — browsers block audible autoplay, so the video silently never starts playing'
    }))
});
