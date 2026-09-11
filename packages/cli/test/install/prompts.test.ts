import { describe, it, expect, vi } from 'vitest';
import { CANCEL_SYMBOL } from '@clack/prompts';

const { selectSpy, groupMultiselectSpy, confirmSpy } = vi.hoisted(() => ({
  selectSpy: vi.fn(async (opts: { options: { value: string; label: string }[] }) => opts.options[0]!.value),
  groupMultiselectSpy: vi.fn(async (opts: { initialValues?: string[] }) => opts.initialValues ?? []),
  confirmSpy: vi.fn(async (_opts: { message: string }) => true)
}));
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clack/prompts')>();
  return { ...actual, select: selectSpy, groupMultiselect: groupMultiselectSpy, confirm: confirmSpy };
});

import { selectAppPrompt, clackPrompts } from '../../src/install/cli.js';

describe('clack prompt strings are terminalSafe', () => {
  const escaped = 'apps/\x1b]0;evil\x07web';

  it('selectAppPrompt sanitizes labels but returns the raw directory name as the value', async () => {
    const picked = await selectAppPrompt([escaped, 'apps/api'], 'pick');
    const opts = selectSpy.mock.calls[0]![0].options;
    expect(opts[0]!.label).toBe('apps/web');
    expect(opts[0]!.value).toBe(escaped);
    expect(picked).toBe(escaped);
  });

  it('confirm sanitizes the plan text and keeps its newlines', async () => {
    await clackPrompts().confirm('row 1\n' + escaped + '\nrow 3');
    const message = (confirmSpy.mock.calls[0]![0] as { message: string }).message;
    expect(message).toBe('Apply this plan?\nrow 1\napps/web\nrow 3');
  });
});

describe('clack cancel (Ctrl+C) maps to the InstallPrompts cancel values', () => {
  it('selectAppPrompt returns null', async () => {
    selectSpy.mockResolvedValueOnce(CANCEL_SYMBOL as never);
    expect(await selectAppPrompt(['apps/web', 'apps/api'], 'pick')).toBeNull();
  });

  it('selectClients returns null', async () => {
    groupMultiselectSpy.mockResolvedValueOnce(CANCEL_SYMBOL as never);
    expect(await clackPrompts().selectClients({ Agents: [] }, [])).toBeNull();
  });

  it('confirm returns false', async () => {
    confirmSpy.mockResolvedValueOnce(CANCEL_SYMBOL as never);
    expect(await clackPrompts().confirm('plan')).toBe(false);
  });
});
