// Phase 3 of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// `install` (gunshi/install.ts) ported directly to gunshi/bone with no legacy runner surviving
// alongside it to compare against (unlike docs/explain, which had a Phase-2a legacy/gunshi
// comparison period) — cells below were verified against `parseInstallArgs`/`resolveInstallArgs`'s
// documented behavior (node:util.parseArgs semantics: a declared string flag consumes ANY
// following token, dash-leading included, unless nothing follows) and pinned directly.
//
// Every cell here is chosen to stay off `runInstall`'s actual write path — `--help`, an argv shape
// resolveInstallArgs rejects outright, or a non-fatal shape that reaches `runInstall` only far
// enough to hit its non-TTY "no client" guidance (its very first branch, before any disk I/O).
// `runInstall` is always invoked with the real `realIO()` here — not this file's captured `io` —
// matching the legacy dispatcher's own hardcoded wiring, so a cell that reaches it prints through
// real stdout/stderr instead of being captured; the snapshot for such a cell legitimately shows an
// empty (or partial — a warning `dispatchInstall` itself prints before calling `runInstall` still
// lands in `io`) capture. That is pinned as-is, not smoothed over.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runInstallCliGunshi } from '../src/gunshi/install.js';
import { captureIO } from './helpers/capture-io.js';

async function gunshi(args: string[]) {
  const io = captureIO();
  const code = await runInstallCliGunshi(args, io);
  return { code, out: io.out, err: io.err };
}

describe('gunshi/bone install — pinned behavior across the argv-shape matrix', () => {
  const cells: { name: string; args: string[] }[] = [
    { name: '--help', args: ['--help'] },
    { name: '-h', args: ['-h'] },
    { name: 'no args (non-TTY, no client)', args: [] },
    { name: '--client bogus (unknown target, fatal)', args: ['--client', 'bogus'] },
    { name: '--refresh --client claude-skill (conflict, fatal)', args: ['--refresh', '--client', 'claude-skill'] },
    // `--client` bare trailing: legacy parses it to boolean `true` (a declared string flag given
    // no value), resolveInstallArgs treats that identically to "not passed" (toList only accepts
    // a string) — non-fatal, falls through to the non-TTY "no client" guidance.
    { name: '--client (bare trailing)', args: ['--client'] },
    { name: '--client= (empty value)', args: ['--client='] },
    // The swallow class guard.ts exists to prevent: legacy's node:util.parseArgs lets a declared
    // string flag consume ANY following token, dash-leading included — `--client` here literally
    // becomes the string `'--force'`, and `--force` is never independently recognized. Without
    // the guard's fallback to a full legacy re-parse, gunshi's own parser (args-tokens) would
    // instead leave `--client` valueless and parse `--force` as its own real boolean flag —
    // silently turning a fatal unknown-client error into a live `--force` no one asked for.
    { name: '--client --force (swallowed as client’s literal value)', args: ['--client', '--force'] },
    { name: '--scope (bare trailing, non-fatal, obsolete-flag warning)', args: ['--scope'] },
    { name: '--scope= (empty value, non-fatal, obsolete-flag warning)', args: ['--scope='] },
    { name: '--scope project (normal-path scope, non-fatal, obsolete-flag warning)', args: ['--scope', 'project'] },
    { name: '--app (bare trailing, non-fatal)', args: ['--app'] },
    // --help short-circuits before resolveInstallArgs ever runs, exactly like legacy — a bare
    // trailing --client that would otherwise need the guard's fallback never gets there.
    { name: '--help --client (help wins, client never resolved)', args: ['--help', '--client'] },
    // The terminator: `--refresh` after `--` is a literal, never a flag — node's own `--`
    // handling (which every legacy runner rode on) leaves `argv.refresh` unset.
    { name: '-- --refresh (terminator: a literal, not the flag)', args: ['--', '--refresh'] },
    // An unknown flag directly before `--client`'s value doesn't swallow it (stripUnknownFlags
    // drops --typo before gunshi ever sees it) — 'bogus' stays fatal on its own, safely.
    { name: '--typo --client bogus (unknown flag before a known value flag)', args: ['--typo', '--client', 'bogus'] }
  ];

  for (const { name, args } of cells) {
    it(`${name}`, async () => {
      expect(await gunshi(args)).toMatchSnapshot();
    });
  }
});

describe('gate (c): in-process, injected IO, no process-global coupling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Restricted to cells that resolve entirely inside `dispatchInstall` (help, or a fatal
  // resolveInstallArgs error) — unlike docs/explain, `install` never gets to claim full injected-IO
  // purity: reaching `runInstall` itself (a non-fatal argv resolution, e.g. bare `install` with no
  // client) hands it a hardcoded `realIO()`, not the caller's `io`, exactly as the legacy
  // `runInstallCli` always did. That quirk is pinned by its own snapshot cells above, not asserted
  // away here.
  it('never calls console.log/console.error/process.stdout.write/process.stderr.write for --help or a fatal argv error', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await gunshi(['--help']);
    await gunshi(['--client', 'bogus']);

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();
  });
});
