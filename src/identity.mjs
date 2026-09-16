import { createHash } from 'node:crypto';

export function deterministicUuid(seed) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  digest[12] = '5';
  digest[16] = ['8', '9', 'a', 'b'][Number.parseInt(digest[16], 16) % 4];
  return `${digest.slice(0, 8).join('')}-${digest.slice(8, 12).join('')}-${digest
    .slice(12, 16)
    .join('')}-${digest.slice(16, 20).join('')}-${digest.slice(20).join('')}`;
}
