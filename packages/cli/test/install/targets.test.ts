import { describe, it, expect } from 'vitest';
import { targetById } from '../../src/install/targets.js';

describe('install targets', () => {
  it('the SKILL.md targets stay retired — skills are distributed via `npx skills add`, not the installer', () => {
    expect(targetById('claude-skill')).toBeUndefined();
    expect(targetById('claude-skill-improve')).toBeUndefined();
  });
});
