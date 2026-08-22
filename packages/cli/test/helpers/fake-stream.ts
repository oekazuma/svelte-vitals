/** A write-capturing stand-in for process.stdout/stderr; `columns`/`rows` stand in for the TTY size. */
export function fakeStream(size: { columns?: number; rows?: number } = {}) {
  const writes: string[] = [];
  const stream = { write: (s: string) => writes.push(s), ...size } as unknown as NodeJS.WriteStream;
  return { writes, stream };
}
