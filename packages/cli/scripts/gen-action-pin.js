#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderActionPin, resolveActionPin } from './resolve-action-pin.js';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const cliDir = join(scriptsDir, '..');
const outPath = join(cliDir, 'src', 'ci', 'action-pin.generated.ts');

const pin = await resolveActionPin();
let content;
try {
  content = renderActionPin(pin);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
writeFileSync(outPath, content);
console.log(`Updated action-pin.generated.ts -> svelte-vitals-action@${pin.version} (${pin.sha})`);
