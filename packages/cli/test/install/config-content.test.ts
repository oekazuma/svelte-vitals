import { describe, it, expect } from 'vitest';
import { buildConfigFileTemplate } from '../../src/install/config-content.js';

describe('buildConfigFileTemplate', () => {
  it('has a default export that is a plain object literal', () => {
    const content = buildConfigFileTemplate();
    expect(content).toContain('export default {');
  });
  it('mentions every Config field, commented out', () => {
    const content = buildConfigFileTemplate();
    for (const field of ['treatDynamicAs', 'metaComponents', 'rules', 'failOn', 'weights']) {
      expect(content).toContain(`// ${field}:`);
    }
  });
  it('links to the configuration docs', () => {
    expect(buildConfigFileTemplate()).toContain('guides/configuration/');
  });
});
