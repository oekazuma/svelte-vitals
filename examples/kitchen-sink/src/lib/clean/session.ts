// A session that fills itself: a load must await `initialize()` before it can read `user`.
export function createSession(fetchFn: typeof fetch) {
  const session = {
    user: null as { name: string } | null,
    async initialize() {
      session.user = await fetchFn('/data/user.json').then((r) => r.json());
    }
  };
  return session;
}
