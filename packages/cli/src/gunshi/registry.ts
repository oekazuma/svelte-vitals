/**
 * Barrel so `scripts/gen-cli-reference.js` can import real arg schemas instead of re-declaring
 * them. Built as its own tsup entry (see tsup.config.ts) rather than imported as TypeScript
 * source: the generator runs under plain `node`, which strips types for a single file but does
 * not resolve the `.js`-specifier-pointing-at-a-sibling-`.ts`-file convention every gunshi/*.ts
 * module uses internally, so a built, self-contained artifact is required. Not part of the
 * package's public `exports` map — this is generator-only plumbing, not a documented library
 * surface. Only re-exports the surfaces that currently have a generated docs-site reference
 * (cli.md, install.md); extend as that scope grows, never by re-declaring a schema.
 */
export { ROOT_ARGS } from './analyze.js';
export { INSTALL_ARGS } from './install.js';
export { JA_ARG_DESCRIPTIONS } from './locales/ja.js';
