export async function load({ fetch }) {
  const user = await fetch('/api/user').then((r) => r.json());
  const detail = await fetch(`/api/detail/${user.id}`).then((r) => r.json());
  const extra = await fetch('/api/extra').then((r) => r.json());
  return { user, detail, extra };
}
