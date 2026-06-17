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
  /** Glob relative to `cwd`, returning paths (adapter decides abs/rel convention). */
  glob(pattern: string, cwd: string): Promise<string[]>;
  /** Join path segments without depending on `node:path`. */
  join(...parts: string[]): string;
}
