import { createInterface } from 'node:readline';
import { convert, indexOperations } from './postman.mjs';
import { listOperations, subsetSchema } from './openapi.mjs';
import { SECONDARY_OPTIONS } from './query-policy.mjs';

async function sendQueries(schema, operations, partition) {
  const result = await convert(schema, SECONDARY_OPTIONS);
  const indexed = indexOperations(result.collection, operations);
  process.stdout.write(JSON.stringify({ partition, warnings: result.warnings,
    queries: [...indexed].map(([key, request]) => ({ key, query: request.url.query })) }) + '\n');
}

// Own the full secondary schema/runtime across the same partition sequence as
// the approved experiment. No primary input mutations or faker state can enter.
for await (const line of createInterface({ input: process.stdin })) {
  const { schema, operations, partitions } = JSON.parse(line);
  if (partitions) {
    const byKey = new Map(listOperations(schema).map(o => [o.key, o]));
    for (const plan of partitions) {
      const selected = plan.keys.map(key => {
        const operation = byKey.get(key);
        if (!operation) throw new Error(`Unexpected secondary operation: ${key}`);
        return operation;
      });
      await sendQueries(subsetSchema(schema, plan.partition, selected), selected, plan.partition.id);
    }
  } else await sendQueries(schema, operations);
}
