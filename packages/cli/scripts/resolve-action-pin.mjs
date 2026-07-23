const REPO = 'oekazuma/svelte-vitals-action';

/**
 * Resolve the pin to bundle for `@svelte-vitals/action`'s replacement — a dedicated
 * repository (see docs/superpowers/specs), so this is a live GitHub API lookup rather than
 * a local `git rev-parse`: the latest release's tag (a plain `vX.Y.Z`, no translation
 * needed for Renovate) resolved to its commit SHA.
 *
 * `fetchImpl` is injectable for testing. Not run as part of the routine build/test/typecheck
 * scripts (that would make every CI run and offline dev build network-dependent) — this only
 * runs via the standalone `pnpm run update-action-pin` maintenance script.
 */
export async function resolveActionPin(fetchImpl = fetch) {
  const release = await getJson(fetchImpl, `https://api.github.com/repos/${REPO}/releases/latest`);
  const version = release.tag_name.replace(/^v/, '');

  const commit = await getJson(fetchImpl, `https://api.github.com/repos/${REPO}/commits/${release.tag_name}`);
  return { sha: commit.sha, version };
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'svelte-vitals-build' }
  });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
