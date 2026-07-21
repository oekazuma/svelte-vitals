export async function load({ fetch }: { fetch: typeof globalThis.fetch }) {
  const user = await fetch('/api/user').then((r: Response) => r.json() as any);
  const posts = await fetch(`/api/posts/${user.id}`).then((r: Response) => r.json() as any);
  const banner = await fetch('/api/banner').then((r: Response) => r.json() as any);
  return { user, posts, banner };
}
