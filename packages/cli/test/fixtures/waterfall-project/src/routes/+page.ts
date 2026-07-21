export async function load({ fetch }) {
  const user = await fetch('/api/user').then((r) => r.json());
  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());
  const banner = await fetch('/api/banner').then((r) => r.json());
  return { user, posts, banner };
}
