// ja `--help` design (docs/superpowers/specs/2026-08-11-cli-ja-help-design.md): `@gunshi/plugin-i18n`
// treats any arg literally named `help`/`version` as one of its own "common args" and resolves its
// description through the plugin's OWN builtin resource — self-registered before our command's
// `resource()`/`arg:help`/`arg:version` keys are ever consulted, and unreachable from outside even
// via a companion plugin's `registerGlobalOptionResources` (confirmed empirically against 0.37.1;
// see `locale.ts`'s own doc comment for the full trace). `localizedOptionsSection` patches the
// plugin's literal English default text back out to our ja text — this test pins those two literal
// strings so a gunshi bump that changes them fails here, loudly, instead of silently turning the
// substitution into a no-op that the ja goldens alone would only show as an unexplained diff.
import { describe, it, expect } from 'vitest';
import { define } from 'gunshi/definition';
import { generate } from 'gunshi/generator';
import i18n, { withI18nResource } from '@gunshi/plugin-i18n';

describe("@gunshi/plugin-i18n's builtin default text for help/version (pinned)", () => {
  it("renders its own English default for an arg named `help`, ignoring the command's own description and resource", async () => {
    const command = define({
      name: 'x',
      args: { help: { type: 'boolean', short: 'h', description: 'Show this help' } },
      run: () => {}
    });
    const wrapped = withI18nResource(command, () => ({ description: '', 'arg:help': 'このヘルプを表示' }));
    const rendered = await generate(null, wrapped, { name: 'x', plugins: [i18n({ locale: 'ja' })] });
    expect(rendered).toContain('Display this help message');
    expect(rendered).not.toContain('このヘルプを表示');
    expect(rendered).not.toContain('Show this help');
  });

  it('renders its own English default for an arg named `version`, same quirk', async () => {
    const command = define({
      name: 'x',
      args: { version: { type: 'boolean', short: 'v', description: 'Show version' } },
      run: () => {}
    });
    const wrapped = withI18nResource(command, () => ({ description: '', 'arg:version': 'バージョンを表示' }));
    const rendered = await generate(null, wrapped, { name: 'x', plugins: [i18n({ locale: 'ja' })] });
    expect(rendered).toContain('Display this version');
    expect(rendered).not.toContain('バージョンを表示');
  });
});
