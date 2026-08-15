// glob-collected, never imported — importing this crashes prerender: module-scope
// code runs on the server the moment the module is imported, and localStorage
// doesn't exist there.
export const cachedFilters = localStorage.getItem('filters'); // correctness/server-browser-global
