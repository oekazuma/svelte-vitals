import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildSkillMarkdown, REPO_SKILLS_HEADER } from '../src/install/skill-content.js';
import { buildImproveSkillMarkdown } from '../src/install/improve-skill-content.js';
import { buildSetupSkillMarkdown } from '../src/install/setup-skill-content.js';

const REGENERATE = 'run `pnpm --filter svelte-vitals run gen:skills`';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const committed = (name: string) => readFileSync(join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');

describe('skills/: the committed skills.sh install copies are up to date', () => {
  it('svelte-vitals', () => {
    expect(committed('svelte-vitals'), REGENERATE).toBe(buildSkillMarkdown(REPO_SKILLS_HEADER));
  });

  it('improve-svelte', () => {
    expect(committed('improve-svelte'), REGENERATE).toBe(buildImproveSkillMarkdown(REPO_SKILLS_HEADER));
  });

  it('setup-svelte-vitals', () => {
    expect(committed('setup-svelte-vitals'), REGENERATE).toBe(buildSetupSkillMarkdown(REPO_SKILLS_HEADER));
  });
});
