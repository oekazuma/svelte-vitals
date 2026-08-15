// seo/ssr-disabled: an SPA-mode route — content is invisible to non-JS crawlers.
// prerender = false pairs with it deliberately: with ssr off, prerendering would
// only bake out an empty shell, so this route relies on adapter-static's fallback
// page instead.
export const ssr = false;
export const prerender = false;
