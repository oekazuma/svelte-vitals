import { kitModuleRule } from '../kit-module-rule.js';

export const sec003LoadStateWrite = kitModuleRule({
  id: 'SEC003',
  title: 'Handler writes imported state',
  category: 'security',
  severity: 'critical',
  label: 'Load/handler purity',
  recommendation:
    'Return the data from load (or the action) and pass it via page data instead of writing it to module state; per-user data belongs in cookies/locals plus a database.',
  rationale:
    "SvelteKit's docs mark this NEVER-DO-THIS: the server is one long-lived process shared by every user, so module state written during a request is visible to ALL later requests — one user's data can be served to another.",
  applies: (m) => m.importedStateWrites.length > 0,
  bad: (m) =>
    m.importedStateWrites.map((w) => ({
      line: w.line,
      message: `a server-executed handler writes imported module state "${w.name}" — shared across all requests on the server, one user's data can leak to another`
    }))
});
