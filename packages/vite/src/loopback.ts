/** Only the local dev server hosts the ingest endpoint, so never POST off-box. */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    // WHATWG URL keeps the brackets on IPv6 hostnames ('[::1]'); a bare '::1' never parses.
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Whether `origin` (an Origin header value) names exactly the server this request reached —
 * `host` is the Host header, `hostname[:port]`. The scheme is deliberately ignored: under
 * `server.https` the Origin is https while the Host header is unchanged. Both sides go
 * through the URL parser so a default port (`localhost:80`) and hostname case compare equal.
 */
export function isSameOrigin(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === new URL(`http://${host}`).host;
  } catch {
    return false;
  }
}
