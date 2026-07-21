import { kitModuleRule } from '../kit-module-rule.js';

const MESSAGE =
  'Sequential dependent awaits in a universal load create a client-side request waterfall — each hop is a network round trip from the browser. Move this chain to a server load (+page.server.ts / +layout.server.ts), where the hops run server-side.';

/**
 * PERF011 — dependent await chains in universal loads. Server loads are exempt:
 * a dependent chain cannot be parallelized, and on the server there is no better
 * placement to suggest. csr = false files are exempt too — without a client
 * runtime the universal load only runs during SSR.
 */
export const perf011LoadWaterfall = kitModuleRule({
  id: 'performance/load-waterfall',
  title: 'Load waterfall',
  category: 'performance',
  severity: 'warning',
  label: 'No load waterfalls',
  recommendation:
    'Move the dependent await chain into a server load (+page.server.ts / +layout.server.ts), where the hops run server-to-server.',
  rationale:
    'In a universal load, every await that depends on a previous result costs a full network round trip from the browser on client-side navigation; chains multiply latency on every page visit. A server load runs the same hops server-side.',
  fix: {
    description:
      'Move the dependent await chain into a server load (+page.server.ts), where hops run server-to-server.',
    snippet:
      '// +page.server.ts — same chain, server-side hops\nexport async function load({ fetch }) {\n  const user = await fetch(`/api/user`).then((r) => r.json());\n  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());\n  return { user, posts };\n}',
    lang: 'ts'
  },
  applies: (m) =>
    m.kind === 'universal' && m.csrDisabled === undefined && (m.loadWaterfalls?.dependentLines.length ?? 0) > 0,
  bad: (m) => m.loadWaterfalls!.dependentLines.map((line) => ({ line, message: MESSAGE }))
});
