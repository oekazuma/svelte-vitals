// File-store canary: `store` is an object of this module's own functions, so `store.set()` writes a file, not module state.
import { readFile, writeFile } from 'node:fs/promises';

type Settings = Record<string, string>;

async function get(key: string): Promise<Settings> {
  return JSON.parse(await readFile(`data/${key}.json`, 'utf8')) as Settings;
}

async function set(key: string, value: Settings): Promise<void> {
  await writeFile(`data/${key}.json`, JSON.stringify(value));
}

export const store = { get, set };
