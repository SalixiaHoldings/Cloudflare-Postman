const major = Number.parseInt(process.versions.node.split('.')[0], 10);
if (major !== 24) {
  console.error(`Node.js 24 is required; received ${process.version}.`);
  process.exit(1);
}
