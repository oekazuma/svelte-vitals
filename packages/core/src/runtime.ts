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
   * an undeclared name. Both shipped adapters pass `dot: false`.
   *
   * **Every returned path is a file, never a directory**, and an adapter must keep that true too:
   * `architecture/reserved-directory-names`' unit test takes a directory's immediate children from
   * this same inventory and asks whether one of them is a file named after the directory, so an
   * adapter that let a directory through here would let a bare `Card/Card` satisfy that test as if it
   * were an entry file. Both shipped adapters get this for free from their glob library's default,
   * which returns files only unless asked to include directories.
   */
  glob(pattern: string, cwd: string): Promise<string[]>;
  /** Join path segments without depending on `node:path`. */
  join(...parts: string[]): string;
}
