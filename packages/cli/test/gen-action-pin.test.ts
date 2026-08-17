import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderActionPin } from '../scripts/resolve-action-pin.js';
import { ACTION_SHA, ACTION_VERSION } from '../src/ci/action-pin.generated.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const generatedPath = join(testDir, '..', 'src', 'ci', 'action-pin.generated.ts');

describe('gen-action-pin: renderActionPin', () => {
  it('renders the values currently committed in action-pin.generated.ts', () => {
    const output = renderActionPin({ sha: ACTION_SHA, version: ACTION_VERSION });
    // JSON.stringify quotes with ", the committed file is oxfmt-formatted to ' — safe to
    // normalize because a value that passes the shape guards can never contain a quote char.
    expect(output.replace(/"/g, "'")).toBe(readFileSync(generatedPath, 'utf8'));
  });

  it('rejects a sha that is too short', () => {
    expect(() => renderActionPin({ sha: 'abc123', version: ACTION_VERSION })).toThrow(
      /sha is not a 40-char lowercase hex commit SHA/
    );
  });

  it('rejects a sha with uppercase hex digits', () => {
    const upper = ACTION_SHA.toUpperCase();
    expect(() => renderActionPin({ sha: upper, version: ACTION_VERSION })).toThrow(
      /sha is not a 40-char lowercase hex commit SHA/
    );
  });

  it('rejects a sha carrying injected content past the 40 hex chars', () => {
    const malicious = `${ACTION_SHA}'; export const evil = 1; //`;
    expect(() => renderActionPin({ sha: malicious, version: ACTION_VERSION })).toThrow(
      /sha is not a 40-char lowercase hex commit SHA/
    );
  });

  it('rejects a version carrying a leading "v" (resolveActionPin already strips it)', () => {
    expect(() => renderActionPin({ sha: ACTION_SHA, version: 'v1.2.3' })).toThrow(
      /version is not a plain X\.Y\.Z semver/
    );
  });

  it('rejects a version carrying injected content', () => {
    const malicious = "1.2.3'; process.exit(1); //";
    expect(() => renderActionPin({ sha: ACTION_SHA, version: malicious })).toThrow(
      /version is not a plain X\.Y\.Z semver/
    );
  });
});
