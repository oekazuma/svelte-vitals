#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSkillMarkdown, REPO_SKILLS_HEADER } from '../dist/install/skill-content.js';
import { buildImproveSkillMarkdown } from '../dist/install/improve-skill-content.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const skills = [
  ['svelte-vitals', buildSkillMarkdown(REPO_SKILLS_HEADER)],
  ['improve-svelte', buildImproveSkillMarkdown(REPO_SKILLS_HEADER)]
];

for (const [name, content] of skills) {
  const path = join(repoRoot, 'skills', name, 'SKILL.md');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`Wrote ${relative(process.cwd(), path)}`);
}
