export const KINDS = ['draft', 'sent'];
export const KNOWN_KINDS = new Set<string>(KINDS);

export function kindLabel(index: number, custom?: string[]) {
  const labels = custom?.length === KINDS.length ? custom : KINDS;
  return labels[index];
}
