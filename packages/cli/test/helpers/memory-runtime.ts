import type { Runtime } from '@svelte-vitals/core';

/**
 * In-memory Runtime for tests (design §8): lets the provider run with no real
 * files, proving the pipeline is runtime-agnostic. Paths are POSIX strings.
 */
export function createMemoryRuntime(files: Record<string, string>): Runtime {
  const map = new Map(Object.entries(files));
  return {
    async readFile(path) {
      const content = map.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async exists(path) {
      return map.has(path);
    },
    async glob(pattern) {
      const re = globToRegExp(pattern);
      return [...map.keys()].filter((key) => re.test(key)).sort();
    },
    join(...parts) {
      return parts.filter((p) => p.length > 0).join('/');
    }
  };
}

/** Escape a literal (non-glob) fragment for embedding in the mock's regex. */
function escapeLiteral(s: string): string {
  return s.replace(/[.+^${}()|[\]\\*]/g, '\\$&');
}

function globToRegExp(pattern: string): RegExp {
  // Tokenize char-by-char so `**/` expands to "any depth" without the later `*`
  // pass corrupting the inserted regex (the previous string-replace approach only
  // matched a single nested segment).
  let body = '';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern.startsWith('**/', i)) {
      // zero or more full path segments, excluding leading-dot dirs to match the
      // real runtime glob (tinyglobby runs with dot:false, so it skips hidden dirs).
      body += '(?:(?!\\.)[^/]+/)*';
      i += 2;
    } else if (pattern.startsWith('**', i)) {
      body += '.*';
      i += 1;
    } else if (pattern[i] === '*') {
      body += '[^/]*';
    } else if (pattern[i] === '{') {
      // Brace-expansion alternation, e.g. `*.svelte{,.ts,.js}` — including empty
      // alternatives. Mirrors tinyglobby/picomatch, which the real Runtime.glob
      // implementations use (core's collectComponentFacts issues one such pattern).
      const end = pattern.indexOf('}', i);
      const alts = pattern.slice(i + 1, end).split(',');
      body += `(?:${alts.map(escapeLiteral).join('|')})`;
      i = end;
    } else if (/[.+^${}()|[\]\\]/.test(pattern[i]!)) {
      body += `\\${pattern[i]}`;
    } else {
      body += pattern[i];
    }
  }
  return new RegExp(`^${body}$`);
}
