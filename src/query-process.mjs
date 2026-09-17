import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export function createQueryConverter() {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./query-worker.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  let stderr = '';
  child.stderr.on('data', bytes => { stderr += bytes; });
  child.stdin.on('error', error => { stderr += error.message; });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Secondary converter exited ${code}: ${stderr}`)));
  });
  // Attach immediately; awaited below on EOF/close, including failures.
  exited.catch(() => {});
  async function receive() {
    const result = await iterator.next();
    if (result.done) { await exited; throw new Error('Secondary converter returned no query result.'); }
    return JSON.parse(result.value);
  }
  return {
    async convertAll(schema, partitions, assignments) {
      child.stdin.write(JSON.stringify({ schema, partitions: partitions.map(partition => ({ partition,
        keys: assignments.get(partition.id).map(o => o.key) })) }) + '\n');
      const results = new Map();
      for (const partition of partitions) {
        const result = await receive();
        if (result.partition !== partition.id || results.has(result.partition)) throw new Error('Secondary partition identity drift.');
        results.set(partition.id, result);
      }
      return results;
    },
    async convert(schema, operations) {
      child.stdin.write(JSON.stringify({ schema, operations: operations.map(({key}) => ({key})) }) + '\n');
      return receive();
    },
    async close() { child.stdin.end(); await exited; lines.close(); }
  };
}
