import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The vendored HTML spec data is MIT-licensed, and MIT's notice clause is about the published copy.
// esbuild drops ordinary block comments from dist, so the notice is a `/*!` legal comment — this
// asserts it survives the build, in the package that already imports core from its built dist.
const coreDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'core', 'dist');

describe('third-party notices reach the published core dist', () => {
  it('carries the @markuplint/html-spec copyright line', () => {
    const js = readdirSync(coreDist)
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(join(coreDist, f), 'utf8'))
      .join('\n');
    expect(js).toContain('Copyright (c) 2017-2024 Yusuke Hirao');
    expect(js).toContain('@markuplint/html-spec@');
  });
});
