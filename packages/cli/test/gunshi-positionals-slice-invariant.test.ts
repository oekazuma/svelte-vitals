// Phase 2a of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// pins gunshi's undocumented ctx.positionals/ctx.commandPath contract that both gunshi/docs.ts
// and gunshi/explain.ts depend on (design doc, "Implementation facts Phase 2 must carry"): for a
// matched sub-command, ctx.positionals is the raw top-level positional array with the matched
// sub-command's own path token(s) spliced in at the front — NOT "args after the sub-command
// name". `ctx.positionals.slice(ctx.commandPath.length)` is what recovers the latter. If a
// gunshi bump changes this shape, THIS test should fail — not a downstream wording mismatch
// three files away in a docs/explain contract test.
//
// The command trees below mirror gunshi/docs.ts and gunshi/explain.ts's actual shape (docs as a
// bone entry with `list`/`show` sub-commands; explain as a bone entry with no sub-commands) so
// the invariant is pinned against the same topology production code relies on.
import { describe, it, expect } from 'vitest';
import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';

describe('gunshi/bone: ctx.positionals includes the matched sub-command path tokens', () => {
  it('docs show config: positionals is ["show","config"], commandPath is ["show"] — slice(commandPath.length) recovers ["config"]', async () => {
    let captured: { positionals: string[]; commandPath: string[] } | undefined;
    const showCommand = define({
      name: 'show',
      args: { name: { type: 'positional', required: false } },
      run: (ctx) => {
        captured = { positionals: ctx.positionals, commandPath: ctx.commandPath };
      }
    });
    const listCommand = define({ name: 'list', run: () => {} });
    const docsCommand = define({
      name: 'docs',
      subCommands: { list: listCommand, show: showCommand },
      run: () => {}
    });

    await cli(['show', 'config'], docsCommand, {
      subCommands: { list: listCommand, show: showCommand },
      fallbackToEntry: true,
      usageSilent: true
    });

    expect(captured?.positionals).toEqual(['show', 'config']);
    expect(captured?.commandPath).toEqual(['show']);
    expect(captured?.positionals.slice(captured!.commandPath.length)).toEqual(['config']);
  });

  it('docs list extra: positionals is ["list","extra"], commandPath is ["list"] — slice recovers ["extra"]', async () => {
    let captured: { positionals: string[]; commandPath: string[] } | undefined;
    const listCommand = define({
      name: 'list',
      run: (ctx) => {
        captured = { positionals: ctx.positionals, commandPath: ctx.commandPath };
      }
    });
    const showCommand = define({ name: 'show', run: () => {} });
    const docsCommand = define({
      name: 'docs',
      subCommands: { list: listCommand, show: showCommand },
      run: () => {}
    });

    await cli(['list', 'extra'], docsCommand, {
      subCommands: { list: listCommand, show: showCommand },
      fallbackToEntry: true,
      usageSilent: true
    });

    expect(captured?.positionals).toEqual(['list', 'extra']);
    expect(captured?.positionals.slice(captured!.commandPath.length)).toEqual(['extra']);
  });

  it('explain <id>: commandPath is [] at the entry level — positionals already IS "args after explain", so the slice is a documented no-op, not a real recovery', async () => {
    let captured: { positionals: string[]; commandPath: string[] } | undefined;
    const explainCommand = define({
      name: 'explain',
      args: { id: { type: 'positional', required: false } },
      run: (ctx) => {
        captured = { positionals: ctx.positionals, commandPath: ctx.commandPath };
      }
    });

    await cli(['seo/title-presence'], explainCommand, { usageSilent: true });

    expect(captured?.commandPath).toEqual([]);
    expect(captured?.positionals).toEqual(['seo/title-presence']);
    expect(captured?.positionals.slice(captured!.commandPath.length)).toEqual(['seo/title-presence']);
  });

  it('docs bogus: an unmatched sub-command reaches the entry (docs root) via fallbackToEntry with commandPath [] — no slicing needed there either', async () => {
    let captured: { positionals: string[]; commandPath: string[]; omitted: boolean } | undefined;
    const listCommand = define({ name: 'list', run: () => {} });
    const showCommand = define({ name: 'show', run: () => {} });
    const docsCommand = define({
      name: 'docs',
      subCommands: { list: listCommand, show: showCommand },
      run: (ctx) => {
        captured = { positionals: ctx.positionals, commandPath: ctx.commandPath, omitted: ctx.omitted };
      }
    });

    await cli(['bogus'], docsCommand, {
      subCommands: { list: listCommand, show: showCommand },
      fallbackToEntry: true,
      usageSilent: true
    });

    expect(captured?.commandPath).toEqual([]);
    expect(captured?.positionals).toEqual(['bogus']);
    expect(captured?.omitted).toBe(false);
  });
});
