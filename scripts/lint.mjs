import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../src/constants.mjs';

async function listModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listModules(absolute)));
    else if (/\.[cm]?js$/u.test(entry.name)) files.push(absolute);
  }
  return files.sort();
}

const files = await listModules(ROOT);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}
console.log(`Syntax-checked ${files.length} JavaScript modules with ${process.version}.`);
