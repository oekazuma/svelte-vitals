import { kitModuleRule } from '../kit-module-rule.js';

const MESSAGE =
  'This await does not use the results of the awaits before it — the requests run sequentially for no reason. Start them together and await them with Promise.all.';

/**
 * PERF013 — independent sequential awaits in any load. Info severity: static
 * data flow cannot see side-effect ordering (e.g. a setup call an API relies
 * on), so the parallelize suggestion stays advisory.
 */
export const perf013SequentialAwaits = kitModuleRule({
  id: 'PERF013',
  title: 'Sequential independent awaits',
  category: 'performance',
  severity: 'info',
  label: 'No needlessly sequential awaits',
  recommendation: 'Start the independent requests together and await them with Promise.all.',
  rationale:
    "Awaits that do not use each other's results still run one after another, adding their latencies; starting them together costs nothing and bounds the wait to the slowest request.",
  fix: {
    description: 'Start the independent requests together and await them with Promise.all.',
    snippet: 'const [a, b] = await Promise.all([fetchA(), fetchB()]);',
    lang: 'ts'
  },
  applies: (m) => (m.loadWaterfalls?.independentLines.length ?? 0) > 0,
  bad: (m) => m.loadWaterfalls!.independentLines.map((line) => ({ line, message: MESSAGE }))
});
