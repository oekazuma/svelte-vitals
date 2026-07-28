import { describe, it, expect } from 'vitest';
import { resolveRepoLocalPath, routeGlobToRegExp } from '../src/index.js';

describe('resolveRepoLocalPath (exported for private-scope-import)', () => {
  it('maps $lib/ to src/lib/', () => {
    expect(resolveRepoLocalPath('$lib/Button.svelte', 'src/routes/+page.svelte')).toBe('src/lib/Button.svelte');
  });
  it('resolves a relative specifier against the importer directory', () => {
    expect(resolveRepoLocalPath('./parts/Badge.svelte', 'src/lib/Card/Card.svelte')).toBe(
      'src/lib/Card/parts/Badge.svelte'
    );
  });
  it('returns undefined for a bare package and for an unknown alias', () => {
    expect(resolveRepoLocalPath('lodash', 'src/lib/C.svelte')).toBeUndefined();
    expect(resolveRepoLocalPath('$app/state', 'src/lib/C.svelte')).toBeUndefined();
    expect(resolveRepoLocalPath('$myalias/lib/x', 'src/lib/C.svelte')).toBeUndefined();
  });
  it('returns undefined when .. escapes the repo root', () => {
    expect(resolveRepoLocalPath('../../../../x', 'src/lib/C.svelte')).toBeUndefined();
  });
});

describe('routeGlobToRegExp (exported for private-scope-import)', () => {
  it('matches ** across segments but not zero segments in a middle position', () => {
    const re = routeGlobToRegExp('src/routes/**/components');
    expect(re.test('src/routes/a/components')).toBe(true);
    expect(re.test('src/routes/a/b/components')).toBe(true);
    expect(re.test('src/routes/components')).toBe(false);
  });
  it('treats SvelteKit bracket and paren segments as literal', () => {
    expect(routeGlobToRegExp('src/routes/**/components').test('src/routes/[id=integer]/components')).toBe(true);
  });
});
