#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { GENERATED_PATH, readTopics, renderModule } from './docs-embed.js';

const topics = readTopics();
writeFileSync(GENERATED_PATH, renderModule(topics));
console.log(`Wrote ${relative(process.cwd(), GENERATED_PATH)} (${topics.length} topics)`);
console.log('\nNow run `pnpm format`.');
