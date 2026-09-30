export async function load() {
  const author = await Promise.resolve({ id: 'kitchen-sink' });
  const posts = await Promise.resolve([`${author.id}-first`, `${author.id}-second`]);
  return { author, posts };
}
