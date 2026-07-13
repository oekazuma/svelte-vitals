import { describe, it, expect } from 'vitest';
import { upgradeActionPin } from '../../src/ci/upgrade.js';

const OLD_SHA = 'a'.repeat(40);
const NEW_SHA = 'b'.repeat(40);

describe('upgradeActionPin', () => {
  it('replaces a pin with a same-line version comment', () => {
    const content = [
      'jobs:',
      '  svelte-vitals:',
      '    steps:',
      `      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`,
      '        with:',
      '          diff: origin/main'
    ].join('\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.replaced).toBe(1);
    expect(outcome.from).toBe('1.0.0');
    expect(outcome.content).toContain(
      `      - uses: oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`
    );
    // Every other line is untouched.
    expect(outcome.content).toContain('        with:');
    expect(outcome.content).toContain('          diff: origin/main');
  });

  it('replaces a pin with no trailing comment, deriving `from` from the sha prefix', () => {
    const content = `      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA}`;
    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.from).toBe(OLD_SHA.slice(0, 7));
    expect(outcome.content).toBe(
      `      - uses: oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`
    );
  });

  it('is tolerant of different indentation (user-edited workflow)', () => {
    const content = `- uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`;
    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.content).toBe(
      `- uses: oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`
    );
  });

  it('replaces every matching line for matrix-style workflows', () => {
    const content = [
      `      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`,
      'some unrelated line',
      `      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`
    ].join('\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.replaced).toBe(2);
    expect(outcome.content?.split('\n').filter((l) => l.includes(NEW_SHA))).toHaveLength(2);
    expect(outcome.content).toContain('some unrelated line');
  });

  it('does not touch other `uses:` pins (e.g. actions/checkout)', () => {
    const content = [
      `      - uses: actions/checkout@${OLD_SHA} # v7.0.0`,
      `      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`
    ].join('\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.replaced).toBe(1);
    expect(outcome.content).toContain(`- uses: actions/checkout@${OLD_SHA} # v7.0.0`);
  });

  it('preserves user customizations elsewhere in the file', () => {
    const content = [
      'on:',
      '  pull_request:',
      '  workflow_dispatch: # custom trigger the user added',
      'jobs:',
      '  svelte-vitals:',
      '    steps:',
      `      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`,
      '      - name: custom follow-up step',
      '        run: echo done'
    ].join('\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.content).toContain('workflow_dispatch: # custom trigger the user added');
    expect(outcome.content).toContain('custom follow-up step');
    expect(outcome.content).toContain('run: echo done');
  });

  it('reports up-to-date when the pin already matches', () => {
    const content = `      - uses: oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`;
    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome).toEqual({ status: 'up-to-date' });
  });

  it('reports no-reference when the workflow has no action reference at all', () => {
    const content = ['on:', '  pull_request:', 'jobs:', '  build:', '    steps:', '      - run: echo hi'].join('\n');
    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome).toEqual({ status: 'no-reference' });
  });

  it('upgrades a CRLF workflow (with a version comment) and preserves \\r\\n on every line', () => {
    const content = [
      'jobs:',
      '  svelte-vitals:',
      '    steps:',
      `      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`,
      '        with:',
      '          diff: origin/main',
      ''
    ].join('\r\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.replaced).toBe(1);
    expect(outcome.from).toBe('1.0.0');
    expect(outcome.content).toContain(
      `      - uses: oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0\r\n`
    );
    // No mixed line endings: stripping every '\r\n' pair must leave no bare '\n' behind.
    expect(outcome.content?.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('upgrades a CRLF workflow with no trailing comment, keeping the line CRLF-terminated', () => {
    const content = [`      - uses: oekazuma/svelte-vitals/packages/action@${OLD_SHA}`, 'next line'].join('\r\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.from).toBe(OLD_SHA.slice(0, 7));
    expect(outcome.content).toBe(
      [
        `      - uses: oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`,
        'next line'
      ].join('\r\n')
    );
  });

  it('reports up-to-date (not no-reference) for a CRLF workflow already pinned to the current sha', () => {
    const content = [
      `      - uses: oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`,
      ''
    ].join('\r\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome).toEqual({ status: 'up-to-date' });
  });
});
