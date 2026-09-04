import { fetchPinnedSchema } from '../src/upstream.mjs';

const { destination, lock } = await fetchPinnedSchema();
console.log(`Verified cloudflare/api-schemas@${lock.commit}`);
console.log(`SHA-256 ${lock.schema.sha256}`);
console.log(destination);
