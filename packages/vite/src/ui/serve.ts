import { buildHtmlDocument, buildJsonReport, type Config, type Result } from '@svelte-vitals/core';

// Injected only by the live UI (not part of the shared core renderer). On an SSE
// `update`, re-fetch the dashboard, swap the `.wrap` element, and re-run the core
// init script (freshly appended <script> executes) so the gauge/filters rebind.
const LIVE_SCRIPT = `<script data-live>
(function(){
  var es=new EventSource('/__svelte-vitals/events');
  es.addEventListener('update',function(){
    fetch('/__svelte-vitals/').then(function(r){return r.text();}).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      var next=doc.querySelector('.wrap'),cur=document.querySelector('.wrap');
      if(next&&cur)cur.replaceWith(next);
      var scripts=doc.querySelectorAll('body > script:not([data-live])');
      var core=scripts[scripts.length-1];
      if(core){var s=document.createElement('script');s.textContent=core.textContent;document.body.appendChild(s);s.remove();}
    }).catch(function(){});
  });
})();
</script>`;

/** The dashboard HTML: the core report document plus the injected live-update script. */
export function renderDashboard(
  results: Result[],
  config: Config,
  meta: { version: string; coreVersion?: string }
): string {
  const html = buildHtmlDocument(buildJsonReport(results, config, meta), meta);
  return html.replace('</body>', LIVE_SCRIPT + '</body>');
}
