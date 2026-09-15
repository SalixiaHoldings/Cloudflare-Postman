import { formatGenerationSummary, generateAll, verifyGenerated } from '../src/generate.mjs';

const check = process.argv.includes('--check');
const result = check ? await verifyGenerated() : await generateAll();
console.log(formatGenerationSummary(result));
if (check) console.log('Checked-in generated artifacts are byte-for-byte reproducible.');
