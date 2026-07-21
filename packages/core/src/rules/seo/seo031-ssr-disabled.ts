import { kitModuleRule } from '../kit-module-rule.js';

/** The root layout — disabling SSR there turns the whole app into an SPA. */
const ROOT_LAYOUT_RE = /^src\/routes\/\+layout(\.server)?\.(ts|js)$/;

/** `ssr` is a page option — it has no effect in `+server` endpoints or hooks files. */
const PAGE_OPTION_FILE_RE = /\+(page|layout)(\.server)?\.(ts|js)$/;

export const seo031SsrDisabled = kitModuleRule({
  id: 'SEO031',
  title: 'SSR disabled',
  category: 'seo',
  label: 'SSR enabled',
  recommendation:
    "Keep SSR on for indexable pages; restrict ssr = false to routes that don't need SEO (authenticated dashboards, app-only views). For a deliberate SPA, turn this rule off in the config or add an inline suppression.",
  rationale:
    "SvelteKit's SEO guidance is to leave SSR on unless there is a good reason not to: server-rendered content is indexed more frequently and reliably, and SPA mode costs an extra network round trip before anything renders.",
  applies: (m) => m.ssrDisabled !== undefined && PAGE_OPTION_FILE_RE.test(m.file),
  bad: (m) => [
    {
      line: m.ssrDisabled!.line,
      message: ROOT_LAYOUT_RE.test(m.file)
        ? 'SSR is disabled for the whole app — search engines index server-rendered content more reliably, and SPA mode adds a network round trip before first paint'
        : "SSR is disabled for this route — its content is invisible to crawlers that don't execute JavaScript and indexes less reliably"
    }
  ]
});
