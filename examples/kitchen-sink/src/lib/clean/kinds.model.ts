export const KINDS = ['draft', 'sent'];

export function kindLabel(index: number, custom?: string[]) {
  const labels = custom?.length === KINDS.length ? custom : KINDS;
  return labels[index];
}
