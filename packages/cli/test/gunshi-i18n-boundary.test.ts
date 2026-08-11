// ja `--help` design (docs/superpowers/specs/2026-08-11-cli-ja-help-design.md): "errors stay
// English" is a tested invariant, not a promise. Representative error/warning/reporter cells,
// re-run under SVELTE_VITALS_LANG=ja, must be byte-equal to the same run under a clean env — this
// CLI never passes `builtinResources` to `@gunshi/plugin-i18n`, so its own validation-error
// rendering has nothing to translate with even if a code path somehow reached it.
import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli, type CliResult } from '../src/cli.js';
import { captureIO } from './helpers/capture-io.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');

const CLEAN_ENV = {};
const JA_ENV = { SVELTE_VITALS_LANG: 'ja' };

async function cliUnder(
  env: Record<string, string>,
  args: string[]
): Promise<CliResult & { out: string; err: string }> {
  const io = captureIO();
  const result = await runCli(args, io, env);
  return { ...result, out: io.out, err: io.err };
}

async function expectByteEqualUnderJa(args: string[]): Promise<void> {
  const en = await cliUnder(CLEAN_ENV, args);
  const ja = await cliUnder(JA_ENV, args);
  expect(ja).toEqual(en);
}

describe('SVELTE_VITALS_LANG=ja never changes non-help output', () => {
  it('an unknown enum value for --reporter (invalid option value)', async () => {
    await expectByteEqualUnderJa(['--reporter', 'nope']);
  });

  it('--reporter= (empty value guard rejection)', async () => {
    await expectByteEqualUnderJa(['--reporter=']);
  });

  it('an unknown flag before a positional (guard/strip class)', async () => {
    await expectByteEqualUnderJa(['--nonsense-flag', fixtureDir]);
  });

  it('--reporter agent output for a real fixture project', async () => {
    await expectByteEqualUnderJa(['--reporter', 'agent', fixtureDir]);
  });

  it('--reporter github output for a real fixture project', async () => {
    await expectByteEqualUnderJa(['--reporter', 'github', fixtureDir]);
  });

  it('--reporter json output for a real fixture project', async () => {
    await expectByteEqualUnderJa(['--reporter', 'json', fixtureDir]);
  });

  it("docs's unknown-subcommand error path (frozen DOCS_HELP)", async () => {
    await expectByteEqualUnderJa(['docs', 'bogus']);
  });

  it("docs show's unknown-topic error path", async () => {
    await expectByteEqualUnderJa(['docs', 'show', 'bogus-topic']);
  });

  it("explain's unknown-rule-id error path", async () => {
    await expectByteEqualUnderJa(['explain', 'bogus/rule-id']);
  });

  it("ci's unknown-subcommand error path (frozen CI_HELP)", async () => {
    await expectByteEqualUnderJa(['ci', 'bogus']);
  });

  it('a guard rejection reaching install (--client with no value)', async () => {
    await expectByteEqualUnderJa(['install', '--client']);
  });

  it('--version (not one of the five --help surfaces — stays English)', async () => {
    await expectByteEqualUnderJa(['--version']);
  });
});
