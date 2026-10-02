const messages = new Map([['Details', 'Details']]);

export function t(key: string): string {
  return messages.get(key) ?? key;
}
