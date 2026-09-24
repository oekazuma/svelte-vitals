const drafts = new Map<string, string>();

export function update(id: string, body: string): void {
  drafts.set(id, body);
}
