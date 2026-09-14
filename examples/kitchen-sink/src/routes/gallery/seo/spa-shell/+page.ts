// seo/ssr-disabled: the second SPA-mode specimen, prerendered (inherited from the root layout)
// so the build output is an empty app shell — the vite plugin must skip it rather than report
// the shell as missing its head, <h1> and <main>.
export const ssr = false;
