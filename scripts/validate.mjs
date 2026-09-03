import { validateAll } from '../src/validate.mjs';

const result = await validateAll();
console.log(`Validated cloudflare/api-schemas@${result.commit}`);
console.log(`Schema SHA-256: ${result.schemaSha256}`);
console.log(`Pinned upstream OpenAPI validation exceptions: ${result.openapiExceptions}`);
console.log(`Exact-once operation accounting: ${result.operations}/${result.operations}`);
for (const partition of result.partitions) {
  console.log(
    `${partition.id}: ${partition.operationCount}${partition.residual ? ' (explicit residual)' : ''}`
  );
}
console.log(`Residual operations: ${result.residual}`);
console.log(`Intentional partition overlaps: ${result.overlapCount} operations in ${result.overlapDeclarations} declarations`);
console.log(`Authentication categories: ${JSON.stringify(result.authentication)}`);
console.log('Postman Collection v2.1 schema validation passed.');
