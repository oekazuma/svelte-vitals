export async function load({ fetch }: { fetch: typeof globalThis.fetch }) {
  const user = await fetch('/api/user').then((r: Response) => r.json() as any);
  const detail = await fetch(`/api/detail/${user.id}`).then((r: Response) => r.json() as any);
  const extra = await fetch('/api/extra').then((r: Response) => r.json() as any);
  return { user, detail, extra };
}
