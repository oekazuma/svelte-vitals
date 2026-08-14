import { roles, aria } from 'aria-query';

export function isKnownRole(role: string): boolean {
  return roles.has(role as Parameters<typeof roles.has>[0]);
}

export function isAbstractRole(role: string): boolean {
  return roles.get(role as Parameters<typeof roles.get>[0])?.abstract === true;
}

export function isKnownAriaAttribute(name: string): boolean {
  return aria.has(name as Parameters<typeof aria.has>[0]);
}

export function requiredAriaProps(role: string): string[] {
  const def = roles.get(role as Parameters<typeof roles.get>[0]);
  return def ? Object.keys(def.requiredProps) : [];
}

export function ariaValueKind(name: string): { type: string; values?: string[] } | undefined {
  const def = aria.get(name as Parameters<typeof aria.get>[0]);
  if (!def) return undefined;
  return { type: def.type, ...(def.values ? { values: def.values.map(String) } : {}) };
}
