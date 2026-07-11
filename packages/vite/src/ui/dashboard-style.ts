/**
 * Hand-authored CSS for the master/detail live dashboard — a separate stylesheet from
 * core's `STYLE` (packages/core/src/reporter/html.ts), by design (see spec: Approach,
 * "Tradeoff, stated explicitly"). Reuses the same token names/values where the two
 * surfaces overlap, and adds a dark theme via `:root[data-theme="dark"]` plus a
 * `prefers-color-scheme` fallback for a first-ever visit with no stored preference.
 */
export const DASHBOARD_STYLE = `
:root{--ground:#f6f7f9;--panel:#fff;--ink:#0c1322;--muted:#5a6472;--faint:#8c95a3;--line:#e4e7ec;--line-strong:#d3d8e0;--accent:#ff3e00;--good:#2fa968;--warn:#e8a317;--poor:#e5484d;--code-bg:#0e1525;--code-ink:#e7ecf4;--active-bg:#0c1322;--active-ink:#fff;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
:root[data-theme="dark"]{--ground:#0b0e14;--panel:#12161f;--ink:#e7ecf4;--muted:#9aa4b2;--faint:#6b7484;--line:#232838;--line-strong:#2d3345;--code-bg:#05070c;--code-ink:#e7ecf4;--active-bg:#e7ecf4;--active-ink:#0b0e14}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0b0e14;--panel:#12161f;--ink:#e7ecf4;--muted:#9aa4b2;--faint:#6b7484;--line:#232838;--line-strong:#2d3345;--code-bg:#05070c;--code-ink:#e7ecf4;--active-bg:#e7ecf4;--active-ink:#0b0e14}}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--ground);color:var(--ink);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased}
.dv-app{display:grid;grid-template-rows:auto 1fr;grid-template-columns:280px 1fr;grid-template-areas:"top top" "side main";height:100vh}
.dv-topbar{grid-area:top;border-bottom:1px solid var(--line);background:var(--panel)}
.dv-topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:12px 20px}
.dv-brand{display:flex;align-items:center}
.dv-brand svg{height:22px;width:auto;display:block}
.dv-meta{font-family:var(--mono);font-size:12px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
.dv-status{display:flex;align-items:center;gap:10px}
.dv-analyzing{font-size:12px;color:var(--accent);font-weight:600}
.dv-conn{width:8px;height:8px;border-radius:50%;background:var(--faint);display:inline-block}
.dv-conn-connected{background:var(--good)}
.dv-conn-reconnecting{background:var(--warn)}
.dv-menu-toggle{display:none;border:1px solid var(--line-strong);background:var(--panel);color:var(--ink);border-radius:8px;width:28px;height:28px;cursor:pointer}
.dv-theme-toggle{border:1px solid var(--line-strong);background:var(--panel);color:var(--ink);border-radius:999px;width:28px;height:28px;cursor:pointer}
.dv-theme-toggle:focus-visible,.dv-menu-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dv-sidebar{grid-area:side;border-right:1px solid var(--line);background:var(--panel);overflow-y:auto}
.dv-sidebar-inner{display:flex;flex-direction:column;gap:10px;padding:14px}
.dv-search{font:inherit;font-size:13px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--ground);color:var(--ink)}
.dv-sort{font:inherit;font-size:12.5px;padding:6px 8px;border:1px solid var(--line-strong);border-radius:8px;background:var(--ground);color:var(--ink)}
.dv-nav{display:flex;flex-direction:column;gap:2px}
.dv-nav-item{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;cursor:pointer}
.dv-nav-item:hover{background:var(--ground)}
.dv-nav-item.active{background:var(--active-bg);color:var(--active-ink)}
.dv-nav-item:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.dv-nav-label{font-family:var(--mono);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dv-nav-meta{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--muted)}
.dv-nav-item.active .dv-nav-meta{color:inherit}
.dv-nav-score{font-family:var(--mono);font-weight:700}
.dv-badge{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:1px 6px;border-radius:999px}
.dv-badge-measured{background:rgba(47,169,104,.16);color:var(--good)}
.dv-badge-static{background:rgba(140,149,163,.2);color:var(--muted)}
.dv-detail{grid-area:main;overflow-y:auto;padding:24px 28px 80px}
.dv-gauge{position:relative;width:132px;height:132px;margin-bottom:20px}
.dv-gauge svg{position:absolute;inset:0;transform:rotate(-90deg)}
.dv-gauge-track{stroke:var(--line)}
.dv-gauge-num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dv-gauge-num strong{font-family:var(--mono);font-size:36px;font-weight:600}
.dv-gauge-num span{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted)}
.dv-cats{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:20px}
.dv-cat{min-width:180px;flex:1}
.dv-cat-top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px}
.dv-bar{height:7px;border-radius:999px;background:var(--line);overflow:hidden}
.dv-bar>i{display:block;height:100%;border-radius:999px}
.dv-filters{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.dv-chip{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;background:var(--panel);border:1px solid var(--line-strong);color:var(--muted);padding:5px 12px;border-radius:999px}
.dv-chip[aria-pressed="true"]{background:var(--active-bg);border-color:var(--active-bg);color:var(--active-ink)}
.dv-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dv-section h2{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:24px 0 12px}
.dv-detail-header{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.dv-route-path{font-family:var(--mono);font-size:16px;font-weight:600}
.dv-score-chip{font-family:var(--mono);font-weight:700}
.dv-finding{background:var(--panel);border:1px solid var(--line);border-left-width:3px;border-radius:10px;padding:16px 18px;margin:0 0 12px}
.dv-finding-critical{border-left-color:var(--poor)}
.dv-finding-warning{border-left-color:var(--warn)}
.dv-finding-info{border-left-color:var(--faint)}
.dv-f-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dv-ruleid{font-family:var(--mono);font-size:12px;font-weight:600;background:var(--ground);padding:2px 8px;border-radius:6px}
.dv-f-title{font-weight:650;font-size:15px}
.dv-sev-tag{margin-left:auto;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.dv-sev-critical{color:var(--poor)}
.dv-sev-warning{color:var(--warn)}
.dv-sev-info{color:var(--faint)}
.dv-f-loc{font-family:var(--mono);font-size:12.5px;color:var(--muted);margin:8px 0 0}
.dv-f-rec{font-size:14px;margin:10px 0 0}
.dv-fix{margin:12px 0 0;background:var(--code-bg);border-radius:8px;overflow:hidden}
.dv-fix-label{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8da0bd;padding:8px 14px 0}
.dv-fix pre{margin:0;padding:8px 14px 14px;overflow-x:auto}
.dv-fix code{font-family:var(--mono);font-size:12.5px;color:var(--code-ink);line-height:1.65;white-space:pre}
.tok-kw{color:#ff7ab8}
.tok-str{color:#9ece6a}
.tok-num{color:#ff9e64}
.tok-cm{color:#6b7280;font-style:italic}
.tok-id{color:var(--code-ink)}
.tok-pn{color:#8da0bd}
.dv-f-link{display:inline-block;margin-top:12px;font-size:13px;font-weight:600;color:var(--accent);text-decoration:none}
.dv-f-link:hover{text-decoration:underline}
.dv-empty{color:var(--muted);font-size:13px}
@media (max-width:640px){.dv-app{grid-template-columns:1fr;grid-template-areas:"top" "main"}.dv-menu-toggle{display:inline-flex}.dv-sidebar{position:fixed;inset:0 20% 0 0;transform:translateX(-100%);transition:transform .2s ease;z-index:10}.dv-sidebar.open{transform:translateX(0)}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
