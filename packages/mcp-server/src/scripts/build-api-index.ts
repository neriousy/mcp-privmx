#!/usr/bin/env tsx

/**
 * Build API Index - Process JSON API specs into structured knowledge
 */

import { APIParser } from '../api/parser.js';
import { APINamespace, APICoverage } from '../api/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface APIIndexResult {
  namespaces: APINamespace[];
  coverage: APICoverage;
  metadata: {
    buildTime: Date;
    sourceFiles: string[];
    version: string;
  };
}

/**
 * Language mappings for API spec files
 */
const LANGUAGE_MAPPINGS: Record<string, string> = {
  js: 'javascript',
  java: 'java',
  swift: 'swift',
  cpp: 'cpp',
  csharp: 'csharp',
  kotlin: 'kotlin',
};

async function buildAPIIndex() {
  console.log('🔧 Phase 2: Build API Knowledge Index\n');

  const specPath =
    process.env.SPEC_PATH || path.join(__dirname, '../../../../../spec');
  const outputPath = path.join(__dirname, '../data/api-index.json');

  console.log(`📁 Spec Path: ${specPath}`);
  console.log(`💾 Output: ${outputPath}\n`);

  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Find all JSON API spec files
    console.log('🔍 Discovering API specification files...');
    const apiFiles = await findAPIFiles(specPath);
    console.log(`✅ Found ${apiFiles.length} API specification files\n`);

    if (apiFiles.length === 0) {
      console.error('❌ No API specification files found!');
      console.log('💡 Make sure the spec directory contains JSON API files');
      process.exit(1);
    }

    // Initialize parser
    const parser = new APIParser();
    const allNamespaces: APINamespace[] = [];
    const sourceFiles: string[] = [];

    // Process each API file
    console.log('📊 Processing API specifications...');
    for (const filePath of apiFiles) {
      try {
        console.log(`  📄 Processing: ${path.basename(filePath)}`);

        const language = detectLanguage(filePath);
        console.log(`    🌍 Language: ${language}`);

        const content = await fs.readFile(filePath, 'utf-8');
        const namespaces = await parser.parseAPISpec(
          content,
          language,
          filePath
        );

        console.log(`    ✅ Parsed ${namespaces.length} namespaces`);

        // Count methods and classes
        let methodCount = 0;
        let classCount = 0;
        for (const ns of namespaces) {
          classCount += ns.classes.length;
          methodCount += ns.functions.length;
          for (const cls of ns.classes) {
            methodCount +=
              cls.methods.length +
              cls.staticMethods.length +
              cls.constructors.length;
          }
        }
        console.log(`    📊 ${classCount} classes, ${methodCount} methods`);

        allNamespaces.push(...namespaces);
        sourceFiles.push(filePath);
      } catch (error) {
        console.error(`  ❌ Failed to process ${filePath}:`, error);
      }
    }

    // Generate coverage statistics
    console.log('\n📈 Generating coverage statistics...');
    const coverage = generateCoverage(allNamespaces);

    console.log(`📊 API Index Summary:`);
    console.log(`  🌍 Languages: ${coverage.languagesCovered.join(', ')}`);
    console.log(`  📊 Total methods: ${coverage.totalMethods}`);
    console.log(`  ✅ Indexed methods: ${coverage.indexedMethods}`);
    console.log(`  📄 Examples: ${coverage.examplesCount}`);
    console.log(`  🔄 Workflows: ${coverage.workflowsCount}`);

    // Build final result
    const result: APIIndexResult = {
      namespaces: allNamespaces,
      coverage,
      metadata: {
        buildTime: new Date(),
        sourceFiles,
        version: '1.0.0',
      },
    };

    // Save to file
    console.log('\n💾 Saving API index...');
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');

    console.log(`✅ API index saved to: ${outputPath}`);
    console.log(
      `📊 Index size: ${(JSON.stringify(result).length / 1024).toFixed(1)}KB`
    );

    // Generate summary report
    console.log('\n📋 API Index Build Summary:');
    console.log(`  ✅ Successfully processed ${sourceFiles.length} files`);
    console.log(`  📊 Generated ${allNamespaces.length} namespaces`);
    console.log(
      `  🎯 Coverage: ${Math.round((coverage.indexedMethods / coverage.totalMethods) * 100)}%`
    );

    console.log(
      '\n🎉 Phase 2 Complete: API knowledge index built successfully!'
    );
    console.log('\n💡 Next steps:');
    console.log(
      '  1. Run `npm run extract-workflows` to extract workflow patterns'
    );
    console.log(
      '  2. Run `npm run generate-templates` to build code templates'
    );
  } catch (error) {
    console.error('\n❌ Failed to build API index:', error);
    process.exit(1);
  }
}

/**
 * Find JavaScript API specification files only
 */
async function findAPIFiles(specPath: string): Promise<string[]> {
  const apiFiles: string[] = [];
  const jsApiDir = path.join(specPath, 'api', 'js');

  try {
    // Check if JS API directory exists
    await fs.access(jsApiDir);

    // Find JSON files in JS directory
    const files = await fs.readdir(jsApiDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        apiFiles.push(path.join(jsApiDir, file));
        console.log(`🔍 Found JS API file: ${file}`);
      }
    }
  } catch {
    console.warn(`⚠️  Could not read JS API directory: ${jsApiDir}`);
  }

  return apiFiles;
}

/**
 * Detect language from file path
 */
function detectLanguage(filePath: string): string {
  const pathParts = filePath.split(path.sep);

  // Look for language indicator in path (e.g., /api/js/out.js.json)
  for (const part of pathParts) {
    if (LANGUAGE_MAPPINGS[part]) {
      return LANGUAGE_MAPPINGS[part];
    }
  }

  // Fallback: try to detect from filename
  const filename = path.basename(filePath);
  if (filename.includes('js')) return 'javascript';
  if (filename.includes('java')) return 'java';
  if (filename.includes('swift')) return 'swift';
  if (filename.includes('cpp')) return 'cpp';
  if (filename.includes('csharp')) return 'csharp';

  // Default fallback
  return 'unknown';
}

/**
 * Generate coverage statistics
 */
function generateCoverage(namespaces: APINamespace[]): APICoverage {
  let totalMethods = 0;
  let indexedMethods = 0;
  let examplesCount = 0;
  const languagesCovered = new Set<string>();

  for (const ns of namespaces) {
    languagesCovered.add(ns.language);

    // Count methods in functions
    totalMethods += ns.functions.length;
    indexedMethods += ns.functions.length; // All parsed methods are indexed

    // Count examples in functions
    for (const func of ns.functions) {
      examplesCount += func.examples.length;
    }

    // Count methods in classes
    for (const cls of ns.classes) {
      const classMethods =
        cls.methods.length + cls.staticMethods.length + cls.constructors.length;
      totalMethods += classMethods;
      indexedMethods += classMethods;

      // Count examples in class methods
      for (const method of [
        ...cls.methods,
        ...cls.staticMethods,
        ...cls.constructors,
      ]) {
        examplesCount += method.examples.length;
      }
    }
  }

  return {
    totalMethods,
    indexedMethods,
    languagesCovered: Array.from(languagesCovered),
    examplesCount,
    workflowsCount: 0, // Will be updated by workflow extractor
  };
}

// Handle command line arguments
const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');

if (helpRequested) {
  console.log(`
🔧 API Index Builder

Processes JSON API specifications into structured knowledge for code generation.

Usage:
  npm run build-api-index
  
Environment Variables:
  SPEC_PATH    Path to spec directory (default: ../../../../spec)
  
Input:
  spec/api/*/    JSON API specification files
  
Output:
  src/data/api-index.json - Structured API knowledge index
  
Examples:
  npm run build-api-index                     # Build API index
  SPEC_PATH=/custom/path npm run build-api-index  # Custom spec path
`);
  process.exit(0);
}

// Run the build
buildAPIIndex().catch(console.error);
