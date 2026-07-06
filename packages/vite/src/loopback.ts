/** Only the local dev server hosts the ingest endpoint, so never POST off-box. */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

/** Same loopback check as `isLoopbackOrigin`, but for a raw `Host` header (may carry a port). */
export function isLoopbackHost(host: string | undefined): boolean {
  if (host === undefined) return false;
  try {
    return isLoopbackOrigin(`http://${host}`);
  } catch {
    return false;
  }
}
