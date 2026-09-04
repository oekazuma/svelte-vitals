import { describe, it, expect, vi } from 'vitest';

const { selectSpy, confirmSpy } = vi.hoisted(() => ({
  selectSpy: vi.fn(async (opts: { options: { value: string; label: string }[] }) => opts.options[0]!.value),
  confirmSpy: vi.fn(async (_opts: { message: string }) => true)
}));
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clack/prompts')>();
  return { ...actual, select: selectSpy, confirm: confirmSpy, isCancel: () => false };
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
