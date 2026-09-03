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
 * `host` is the Host header, `hostname[:port]`, and `secure` is whether the connection is TLS.
 * Compared as hostname + effective port: each side's omitted port resolves to its own scheme's
 * default (the Origin's from its URL scheme, the Host's from `secure`), so `https://localhost`
 * never matches a plain-http server on :80 and `https://localhost:443` does match a TLS server
 * whose Host is `localhost:443`. The Origin's scheme is otherwise not compared: under
 * `server.https` the Origin is https while the Host header is unchanged.
 */
export function isSameOrigin(origin: string, host: string, secure = false): boolean {
  try {
    const o = new URL(origin);
    const h = new URL(`${secure ? 'https' : 'http'}://${host}`);
    return o.hostname === h.hostname && effectivePort(o) === effectivePort(h);
  } catch {
    return false;
  }
}

function effectivePort(url: URL): string {
  return url.port || (url.protocol === 'https:' ? '443' : '80');
}
