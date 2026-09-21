import assert from 'node:assert/strict';
import { sha256 } from './io.mjs';

// Parse independently from the converter working graph, before any conversion.
// Only request-body contracts may consume this source; never pass it to a converter.
export function createRequestBodySource(bytes) {
  const document = JSON.parse(bytes);
  function freeze(value) {
    if (!value || typeof value !== 'object') return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  freeze(document);
  const fingerprint = sha256(JSON.stringify(document));
  return {
    document,
    assertUnchanged() {
      assert.equal(sha256(JSON.stringify(document)), fingerprint,
        'Pristine request-body source changed during generation.');
    }
  };
}
