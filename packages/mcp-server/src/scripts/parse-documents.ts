#!/usr/bin/env tsx

import { DocumentProcessor } from '../loaders/document-processor.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ParsedDocuments {
  documents: any[];
  metadata: {
    totalDocuments: number;
    byType: Record<string, number>;
    byLanguage: Record<string, number>;
    sources: string[];
  };
}

async function parseDocuments() {
  console.log('📚 Phase 1: Document Parsing\n');

  const specPath =
    process.env.SPEC_PATH || path.join(__dirname, '../../../../spec');
  const outputPath = path.join(__dirname, '../data/parsed-documents.json');

  console.log(`📁 Source: ${specPath}`);
  console.log(`💾 Output: ${outputPath}\n`);

  try {
    // Initialize document processor
    const processor = new DocumentProcessor({
      chunkSize: 1200,
      chunkOverlap: 200,
      preserveCodeBlocks: true,
      extractMetadata: true,
    });

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    console.log('🔍 Discovering documents...');

    // Process all documents from spec directory
    const documents = await processor.processDirectory(specPath);

    console.log(`✅ Parsed ${documents.length} documents\n`);

    // Analyze the parsed documents
    const metadata = {
      totalDocuments: documents.length,
      byType: {} as Record<string, number>,
      byLanguage: {} as Record<string, number>,
      sources: [] as string[],
    };

    documents.forEach((doc) => {
      const type = doc.metadata?.type || 'unknown';
      const source = doc.metadata?.source || 'unknown';

      metadata.byType[type] = (metadata.byType[type] || 0) + 1;

      // Extract language from path
      const pathParts = source.split('/');
      const langIndex = pathParts.findIndex((part: string) =>
        ['js', 'cpp', 'java', 'csharp', 'swift', 'kotlin'].includes(part)
      );
      if (langIndex !== -1) {
        const lang = pathParts[langIndex];
        metadata.byLanguage[lang] = (metadata.byLanguage[lang] || 0) + 1;
      }

      if (!metadata.sources.includes(source)) {
        metadata.sources.push(source);
      }
    });

    // Save parsed documents
    const output: ParsedDocuments = {
      documents,
      metadata,
    };

    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

    console.log('📊 Parsing Summary:');
    console.log(`  📄 Total documents: ${metadata.totalDocuments}`);
    console.log(`  📂 By type:`, metadata.byType);
    console.log(`  🌐 By language:`, metadata.byLanguage);
    console.log(`  📁 Sources: ${metadata.sources.length} files`);

    console.log(`\n💾 Saved to: ${outputPath}`);
    console.log('\n✅ Phase 1 Complete: Documents parsed successfully!');
    console.log(
      '\n➡️  Next: Run `npm run test-option-a` to test the API knowledge service'
    );
  } catch (error) {
    console.error('\n❌ Parsing failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');

if (helpRequested) {
  console.log(`
📚 Document Parser

Parses all PrivMX documentation from /spec directory into structured format.

Usage:
  npm run parse
  
Environment Variables:
  SPEC_PATH       Path to spec directory (default: ../../../../spec)
  
Output:
  src/data/parsed-documents.json - Parsed documents with metadata
  
Examples:
  npm run parse                    # Parse all documents
  SPEC_PATH=/custom/path npm run parse  # Custom spec path
`);
  process.exit(0);
}

parseDocuments().catch(console.error);
