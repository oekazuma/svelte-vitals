/** A write-capturing stand-in for process.stdout/stderr; `columns`/`rows` stand in for the TTY size. */
export function fakeStream(tty: { isTTY?: boolean; columns?: number; rows?: number } = {}) {
  const writes: string[] = [];
  const write = (s: string): boolean => {
    writes.push(s);
    return true;
  };
  const stream = { write, ...tty } as NodeJS.WriteStream;
  return { writes, stream };
}
