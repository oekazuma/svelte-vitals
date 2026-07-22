import { kitModuleRule } from '../kit-module-rule.js';

export const securityServerModuleState = kitModuleRule({
  id: 'security/server-module-state',
  title: 'Server module-scope state',
  category: 'security',
  label: 'Server module state',
  recommendation:
    'Do not keep request data in module scope on the server — authenticate with cookies/locals and persist per-user data in a database. For a deliberate process-wide cache, prefer a const container (e.g. a Map) or add an inline suppression.',
  rationale:
    'Module scope on the server is one shared, long-lived instance (SvelteKit docs: "Avoid shared state on the server"): a value reassigned during one user\'s request is served to every other user, and it silently resets on every deploy or restart.',
  applies: (m) => m.moduleStateReassignments.length > 0,
  bad: (m) =>
    m.moduleStateReassignments.map((r) => ({
      line: r.line,
      message: r.inHandler
        ? `module-scope variable "${r.name}" is reassigned from a request handler — its value is shared across all requests on the server`
        : `module-scope variable "${r.name}" is reassigned from a function — if it runs during a request, the value is shared across all requests on the server`
    }))
});
