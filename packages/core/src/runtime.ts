/**
 * Runtime abstraction (design §8). Core defines only the interface; concrete
 * adapters (Node / Deno / Bun) live in the CLI package and are the only place
 * allowed to touch runtime-specific I/O APIs. Providers and rules use this
 * interface exclusively, which keeps them runtime-agnostic and lets tests inject
 * an in-memory implementation.
 */
export interface Runtime {
  /** Read a UTF-8 text file. Rejects if the file does not exist. */
  readFile(path: string): Promise<string>;
  /** Whether a path exists. */
  exists(path: string): Promise<boolean>;
  /**
   * Paths matching `pattern`, relative to `cwd`.
   *
   * **Dot files and dot directories are excluded**, and an adapter must keep it that way: the
   * directory-shaped Architecture rules derive their directory set from these paths, and one of them
   * enumerates a parent's children exhaustively, so a `.server/` appearing here would be reported as
   * an undeclared name. Both shipped adapters rely on `node:fs` glob's default, which never
   * matches dot entries.
   *
   * **Every returned path is a file, never a directory**, and an adapter must keep that true too:
   * `architecture/reserved-directory-names`' unit test takes a directory's immediate children from
   * this same inventory and asks whether one of them is a file named after the directory, so an
   * adapter that let a directory through here would let a bare `Card/Card` satisfy that test as if it
   * were an entry file. Both shipped adapters filter to files explicitly — `node:fs`'s glob
   * matches directories too.
   */
  glob(pattern: string, cwd: string): Promise<string[]>;
  /** Join path segments without depending on `node:path`. */
  join(...parts: string[]): string;
}

/**
 * How many file reads may be in flight at once. Analysis reads every `.svelte` file in a project
 * in parallel, which on a large project opens more descriptors than the process is allowed: at
 * `ulimit -n 1024` — a common container default — a 1 681-route project raised `EMFILE`, and
 * because a failed read lands in the same `catch` as a malformed component, 682 files were dropped
 * and the run still reported a normal score. The cap is what keeps the analysis whole.
 *
 * 64 is chosen to sit well under the stock 256 on macOS while leaving descriptors for everything
 * else the process holds open. It is not a throughput knob: reads are a few percent of the work.
 */
export const READ_CONCURRENCY = 64;

/**
 * `readFile` with at most `limit` reads in flight. A plain counter plus a queue of waiters —
 * deliberately not a dependency, and pure enough to live in core.
 */
export function withReadLimit(
  readFile: (path: string) => Promise<string>,
  limit: number = READ_CONCURRENCY
): (path: string) => Promise<string> {
  let active = 0;
  const waiting: (() => void)[] = [];
  const release = (): void => {
    active--;
    waiting.shift()?.();
  };
  return async (path) => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await readFile(path);
    } finally {
      release();
    }
  };
}
