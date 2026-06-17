// Slice 0 runtime check (design §19): confirm `svelte/compiler` imports and
// parses across runtimes. The adapter is Node-only for now; this only verifies
// that the import + parse resolve, which is the part that differs per runtime.
//
//   Node:  node scripts/verify-svelte-import.mjs
//   Deno:  deno run -A scripts/verify-svelte-import.mjs
//   Bun:   bun run scripts/verify-svelte-import.mjs
//
// `svelte` is a root devDependency, so the bare import resolves from the repo
// root for every runtime.
import { parse, VERSION } from 'svelte/compiler';

const ast = parse('<svelte:head><title>{data.title}</title></svelte:head>', { modern: true });
const head = ast.fragment.nodes.find((n) => n.type === 'SvelteHead');
const title = head?.fragment.nodes.find((n) => n.type === 'TitleElement');
const dynamic = title?.fragment.nodes.some((n) => n.type === 'ExpressionTag');

if (!title || !dynamic) {
  console.error('FAIL: expected a TitleElement containing an ExpressionTag');
  process.exit(1);
}
console.log(`OK svelte@${VERSION}: parsed <svelte:head><title>{...}</title>, ExpressionTag detected`);
