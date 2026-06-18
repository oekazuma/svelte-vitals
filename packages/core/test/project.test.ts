import { describe, it, expect } from 'vitest';
import { defaultProject } from '../src/index.js';

describe('defaultProject', () => {
  it('is empty/none by default', () => {
    expect(defaultProject).toEqual({
      hasRobotsTxt: false,
      hasSitemap: false,
      htmlLang: { presence: 'none', value: 'absent' }
    });
  });
});
