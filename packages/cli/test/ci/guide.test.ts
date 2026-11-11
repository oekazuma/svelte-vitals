import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildWorkflowYaml } from '../../src/ci/workflow.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');

const PAGES = [
  { page: 'guides/(reporting)/ci.md', heading: '## Writing it by hand' },
  { page: 'ja/guides/(reporting)/ci.md', heading: '## 手書きする場合' }
];

function handWrittenBlocks(page: string, heading: string): string[] {
  const start = page.indexOf(`\n${heading}\n`);
  expect(start).toBeGreaterThan(-1);
  const end = page.indexOf('\n## ', start + 1);
  const section = page.slice(start, end === -1 ? undefined : end);
  return [...section.matchAll(/^```yaml\n([\s\S]*?)^```$/gm)].map((m) => m[1]!);
}

describe('the CI guide shows the workflow ci install generates', () => {
  const expected = (['npm', 'pnpm'] as const).map((kind) =>
    buildWorkflowYaml({ actionSha: '<sha>', actionVersion: '<version>', installStep: { kind } })
  );

  it.each(PAGES)('$page', ({ page, heading }) => {
    expect(handWrittenBlocks(readFileSync(join(docsRoot, page), 'utf-8'), heading)).toEqual(expected);
  });
});
