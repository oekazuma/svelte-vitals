// The index-file indirection is the point: `$lib/clean/seo` is a bare-directory specifier the
// static analyzer cannot follow (it only guesses `seo.svelte`), so OpaqueSeo is only credited
// through the `metaComponents` declaration — the lever's one legitimate case.
export { default } from './OpaqueSeo.svelte';
