#!/usr/bin/env ts-node
import { QdrantVectorAdapter } from '../../src/services/vector/qdrant-adapter.js';

async function main() {
  console.log('⚠️  This will delete the Qdrant collection and its vectors.');
  if (process.argv.includes('--yes')) {
    const adapter = new QdrantVectorAdapter();
    await adapter.clearCollection();
    console.log('✅ Vector collection cleared');
  } else {
    console.log('Add --yes to confirm');
  }
}

main();
