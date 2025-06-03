#!/usr/bin/env node

/**
 * PrivMX Documentation CLI
 *
 * Command-line interface for managing and interacting with the PrivMX documentation system.
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// CLI Configuration
const CLI_CONFIG = {
  name: 'privmx-docs',
  version: '1.0.0',
  description: 'PrivMX Documentation Management CLI',
  dataPath: path.join(__dirname, '../../../data'),
  serverPath: path.join(
    __dirname,
    '../../../packages/mcp-server/src/server.ts'
  ),
};

program
  .name(CLI_CONFIG.name)
  .description(CLI_CONFIG.description)
  .version(CLI_CONFIG.version);

/**
 * Index documentation command
 */
program
  .command('index')
  .description('Process and index PrivMX documentation')
  .option('-f, --force', 'Force re-indexing even if data exists')
  .option('-v, --verbose', 'Show detailed processing information')
  .action(async (options) => {
    console.log('🔄 Starting documentation indexing...');

    try {
      // Check if data already exists
      const chunksFile = path.join(
        CLI_CONFIG.dataPath,
        'processed-chunks.json'
      );
      const summaryFile = path.join(
        CLI_CONFIG.dataPath,
        'indexing-summary.json'
      );

      if (!options.force) {
        try {
          await fs.access(chunksFile);
          await fs.access(summaryFile);
          console.log(
            '📊 Documentation already indexed. Use --force to re-index.'
          );

          // Show current stats
          const summary = JSON.parse(await fs.readFile(summaryFile, 'utf-8'));
          console.log(`\n📈 Current Index Stats:`);
          console.log(
            `  • Total chunks: ${summary.chunkStatistics?.totalChunks || summary.processingMetadata?.totalOutputChunks || 'Unknown'}`
          );
          console.log(
            `  • Total input items: ${summary.processingMetadata?.totalInputItems || 'Unknown'}`
          );
          console.log(
            `  • Average chunk size: ${summary.chunkStatistics?.averageSize || 'Unknown'} chars`
          );
          console.log(
            `  • Last updated: ${new Date(summary.indexingDate).toLocaleString()}`
          );
          return;
        } catch {
          // Files don't exist, proceed with indexing
        }
      }

      // Run the indexing script
      const indexerPath = path.join(
        __dirname,
        '../../../packages/mcp-server/src/scripts/index-docs.ts'
      );

      console.log('📖 Processing documentation files...');

      // Use tsx to run the TypeScript indexer
      const indexProcess = spawn(
        path.join(
          __dirname,
          '../../../packages/mcp-server/node_modules/.bin/tsx'
        ),
        [indexerPath],
        {
          stdio: options.verbose ? 'inherit' : 'pipe',
          cwd: path.join(__dirname, '../../../packages/mcp-server'),
        }
      );

      await new Promise((resolve, reject) => {
        indexProcess.on('close', (code) => {
          if (code === 0) {
            resolve(code);
          } else {
            reject(new Error(`Indexing failed with code ${code}`));
          }
        });

        indexProcess.on('error', reject);
      });

      // Show results
      try {
        const summary = JSON.parse(await fs.readFile(summaryFile, 'utf-8'));
        console.log('\n✅ Documentation indexing completed!');
        console.log(`\n📈 Index Results:`);
        console.log(
          `  • Total chunks: ${summary.chunkStatistics?.totalChunks || summary.processingMetadata?.totalOutputChunks || 'Unknown'}`
        );
        console.log(
          `  • Total input items: ${summary.processingMetadata?.totalInputItems || 'Unknown'}`
        );
        console.log(
          `  • Average chunk size: ${summary.chunkStatistics?.averageSize || 'Unknown'} chars`
        );
        console.log(
          `  • Processing time: ${Math.round(summary.processingMetadata?.processingTime || 0)}ms`
        );
        console.log(`  • Data saved to: ${CLI_CONFIG.dataPath}`);
      } catch (error) {
        console.log('✅ Indexing completed, but could not read summary.');
      }
    } catch (error) {
      console.error(
        '❌ Indexing failed:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Start MCP server command
 */
program
  .command('start')
  .description('Start the PrivMX MCP server')
  .option(
    '-p, --port <port>',
    'Port to run server on (for future HTTP mode)',
    '3000'
  )
  .option('-v, --verbose', 'Show detailed server logs')
  .action(async (options) => {
    console.log('🚀 Starting PrivMX MCP Server...');

    try {
      // Check if documentation is indexed
      const chunksFile = path.join(
        CLI_CONFIG.dataPath,
        'processed-chunks.json'
      );
      try {
        await fs.access(chunksFile);
      } catch {
        console.log(
          '⚠️  No indexed documentation found. Running indexing first...'
        );

        // Run indexing
        const indexerPath = path.join(
          __dirname,
          '../../../packages/mcp-server/src/scripts/index-docs.ts'
        );
        const indexProcess = spawn(
          path.join(
            __dirname,
            '../../../packages/mcp-server/node_modules/.bin/tsx'
          ),
          [indexerPath],
          {
            stdio: 'pipe',
            cwd: path.join(__dirname, '../../../packages/mcp-server'),
          }
        );

        await new Promise((resolve, reject) => {
          indexProcess.on('close', (code) => {
            if (code === 0) {
              console.log('✅ Documentation indexed successfully.');
              resolve(code);
            } else {
              reject(new Error(`Indexing failed with code ${code}`));
            }
          });
          indexProcess.on('error', reject);
        });
      }

      // Start the MCP server
      console.log('📡 Starting MCP server in stdio mode...');

      const serverProcess = spawn(
        path.join(
          __dirname,
          '../../../packages/mcp-server/node_modules/.bin/tsx'
        ),
        [CLI_CONFIG.serverPath],
        {
          stdio: options.verbose
            ? 'inherit'
            : ['inherit', 'inherit', 'inherit'],
          cwd: path.join(__dirname, '../../../packages/mcp-server'),
        }
      );

      // Handle server process
      serverProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ MCP server stopped gracefully.');
        } else {
          console.log(`⚠️  MCP server exited with code ${code}`);
        }
      });

      serverProcess.on('error', (error) => {
        console.error('❌ Failed to start MCP server:', error.message);
        process.exit(1);
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down MCP server...');
        serverProcess.kill('SIGTERM');
      });

      process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down MCP server...');
        serverProcess.kill('SIGTERM');
      });
    } catch (error) {
      console.error(
        '❌ Failed to start server:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command('status')
  .description('Show documentation index and server status')
  .action(async () => {
    console.log('📊 PrivMX Documentation System Status\n');

    try {
      // Check data directory
      const dataExists = await fs
        .access(CLI_CONFIG.dataPath)
        .then(() => true)
        .catch(() => false);
      console.log(
        `📁 Data Directory: ${dataExists ? '✅' : '❌'} ${CLI_CONFIG.dataPath}`
      );

      if (!dataExists) {
        console.log(
          '   No data directory found. Run `privmx-docs index` to create it.'
        );
        return;
      }

      // Check processed chunks
      const chunksFile = path.join(
        CLI_CONFIG.dataPath,
        'processed-chunks.json'
      );
      const chunksExist = await fs
        .access(chunksFile)
        .then(() => true)
        .catch(() => false);
      console.log(
        `📦 Processed Chunks: ${chunksExist ? '✅' : '❌'} ${chunksExist ? 'Available' : 'Missing'}`
      );

      // Check indexing summary
      const summaryFile = path.join(
        CLI_CONFIG.dataPath,
        'indexing-summary.json'
      );
      const summaryExists = await fs
        .access(summaryFile)
        .then(() => true)
        .catch(() => false);
      console.log(
        `📋 Index Summary: ${summaryExists ? '✅' : '❌'} ${summaryExists ? 'Available' : 'Missing'}`
      );

      if (summaryExists) {
        try {
          const summary = JSON.parse(await fs.readFile(summaryFile, 'utf-8'));
          console.log('\n📈 Index Statistics:');
          console.log(
            `  • Total chunks: ${summary.chunkStatistics?.totalChunks || summary.processingMetadata?.totalOutputChunks || 'Unknown'}`
          );
          console.log(
            `  • Total input items: ${summary.processingMetadata?.totalInputItems || 'Unknown'}`
          );
          console.log(
            `  • Average chunk size: ${summary.chunkStatistics?.averageSize || 'Unknown'} chars`
          );
          console.log(
            `  • Last indexed: ${new Date(summary.indexingDate).toLocaleString()}`
          );
          console.log(
            `  • Processing time: ${Math.round(summary.processingMetadata?.processingTime || 0)}ms`
          );
          console.log(
            `  • Strategy used: ${summary.processingMetadata?.strategy || 'Unknown'}`
          );

          if (summary.chunkStatistics?.namespaceDistribution) {
            console.log('\n📊 Namespace Distribution:');
            Object.entries(
              summary.chunkStatistics.namespaceDistribution
            ).forEach(([namespace, count]) => {
              console.log(`  • ${namespace}: ${count} chunks`);
            });
          }

          if (
            summary.validationResults?.errors &&
            summary.validationResults.errors.length > 0
          ) {
            console.log(
              `\n❌ Errors: ${summary.validationResults.errors.length}`
            );
            summary.validationResults.errors.forEach(
              (error: string, i: number) => {
                console.log(`    ${i + 1}. ${error}`);
              }
            );
          }

          if (
            summary.validationResults?.warnings &&
            summary.validationResults.warnings.length > 0
          ) {
            console.log(
              `\n⚠️  Warnings: ${summary.validationResults.warnings.length}`
            );
            summary.validationResults.warnings.forEach(
              (warning: string, i: number) => {
                console.log(`    ${i + 1}. ${warning}`);
              }
            );
          }
        } catch (error) {
          console.log('   ⚠️  Could not read summary details.');
        }
      }

      // Check source files
      console.log('\n📚 Source Documentation:');
      const specDir = path.join(__dirname, '../../../spec');
      const specExists = await fs
        .access(specDir)
        .then(() => true)
        .catch(() => false);
      console.log(`  • Spec directory: ${specExists ? '✅' : '❌'} ${specDir}`);

      if (specExists) {
        const jsonFile = path.join(specDir, 'out.js.json');
        const jsonExists = await fs
          .access(jsonFile)
          .then(() => true)
          .catch(() => false);
        console.log(
          `  • JSON API spec: ${jsonExists ? '✅' : '❌'} ${jsonExists ? 'Found' : 'Missing'}`
        );

        const mdxDir = path.join(specDir, 'mdx');
        const mdxExists = await fs
          .access(mdxDir)
          .then(() => true)
          .catch(() => false);
        console.log(
          `  • MDX tutorials: ${mdxExists ? '✅' : '❌'} ${mdxExists ? 'Found' : 'Missing'}`
        );

        if (mdxExists) {
          try {
            const mdxFiles = await fs.readdir(mdxDir);
            const mdxCount = mdxFiles.filter((f) => f.endsWith('.mdx')).length;
            console.log(`    Found ${mdxCount} MDX files`);
          } catch {
            console.log('    Could not count MDX files');
          }
        }
      }

      // System recommendations
      console.log('\n💡 Recommendations:');
      if (!chunksExist) {
        console.log('  • Run `privmx-docs index` to process documentation');
      } else {
        console.log('  • Documentation is ready for MCP server');
        console.log('  • Run `privmx-docs start` to start the MCP server');
      }
    } catch (error) {
      console.error(
        '❌ Failed to check status:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Search command (for testing)
 */
program
  .command('search')
  .description('Test search functionality against indexed documentation')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum number of results', '5')
  .option('-n, --namespace <namespace>', 'Filter by namespace')
  .option('-t, --type <type>', 'Filter by content type')
  .action(async (query, options) => {
    console.log(`🔍 Searching for: "${query}"`);

    try {
      // Load processed chunks
      const chunksFile = path.join(
        CLI_CONFIG.dataPath,
        'processed-chunks.json'
      );
      const chunksData = JSON.parse(await fs.readFile(chunksFile, 'utf-8'));
      const chunks = chunksData.chunks || [];

      if (chunks.length === 0) {
        console.log(
          '❌ No indexed documentation found. Run `privmx-docs index` first.'
        );
        return;
      }

      // Simple text search
      let results = chunks.filter((chunk: any) => {
        const contentMatch = chunk.content
          .toLowerCase()
          .includes(query.toLowerCase());
        const idMatch = chunk.id.toLowerCase().includes(query.toLowerCase());

        if (!contentMatch && !idMatch) return false;

        // Apply filters
        if (options.namespace && chunk.metadata.namespace !== options.namespace)
          return false;
        if (options.type && chunk.metadata.type !== options.type) return false;

        return true;
      });

      // Limit results
      const limit = parseInt(options.limit) || 5;
      results = results.slice(0, limit);

      if (results.length === 0) {
        console.log('❌ No results found.');
        console.log(
          '💡 Try different keywords or check available namespaces with `privmx-docs status`'
        );
        return;
      }

      console.log(`\n✅ Found ${results.length} results:\n`);

      results.forEach((chunk: any, index: number) => {
        const title = chunk.content.match(/^#\s+(.+)$/m)?.[1] || chunk.id;
        const preview = chunk.content
          .replace(/^#{1,6}\s+.+$/gm, '')
          .trim()
          .split('\n\n')[0];
        const shortPreview =
          preview.length > 100 ? preview.substring(0, 100) + '...' : preview;

        console.log(`${index + 1}. **${title}** (${chunk.metadata.namespace})`);
        console.log(`   ${shortPreview}`);
        console.log(
          `   Type: ${chunk.metadata.type} | Importance: ${chunk.metadata.importance}`
        );
        console.log('');
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.log(
          '❌ No indexed documentation found. Run `privmx-docs index` first.'
        );
      } else {
        console.error(
          '❌ Search failed:',
          error instanceof Error ? error.message : error
        );
      }
      process.exit(1);
    }
  });

/**
 * Generate embeddings command (Phase 4)
 */
program
  .command('embeddings')
  .description(
    'Generate vector embeddings for semantic search (requires OPENAI_API_KEY)'
  )
  .option('-f, --force', 'Force regeneration of all embeddings')
  .option('-t, --test', 'Test embeddings with a sample query')
  .action(async (options) => {
    console.log('🚀 Starting embeddings generation...');

    try {
      // Check if documentation is indexed
      const chunksFile = path.join(
        CLI_CONFIG.dataPath,
        'processed-chunks.json'
      );
      try {
        await fs.access(chunksFile);
      } catch {
        console.log(
          '❌ No indexed documentation found. Run `privmx-docs index` first.'
        );
        return;
      }

      // Check for OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('❌ OPENAI_API_KEY environment variable is required.');
        console.log('💡 Set your OpenAI API key:');
        console.log('   export OPENAI_API_KEY="your-api-key-here"');
        console.log(
          '   Or create a .env file in the mcp-server package directory'
        );
        return;
      }

      // Run the embeddings generation script
      const embeddingsPath = path.join(
        __dirname,
        '../../../packages/mcp-server/src/scripts/generate-embeddings.ts'
      );

      const args = ['tsx', embeddingsPath];
      if (options.force) args.push('--force');
      if (options.test) args.push('--test');

      console.log('🔄 Processing embeddings...');

      const embeddingsProcess = spawn(
        path.join(
          __dirname,
          '../../../packages/mcp-server/node_modules/.bin/tsx'
        ),
        [
          embeddingsPath,
          ...(options.force ? ['--force'] : []),
          ...(options.test ? ['--test'] : []),
        ],
        {
          stdio: 'inherit',
          cwd: path.join(__dirname, '../../../packages/mcp-server'),
          env: { ...process.env },
        }
      );

      await new Promise((resolve, reject) => {
        embeddingsProcess.on('close', (code) => {
          if (code === 0) {
            resolve(code);
          } else {
            reject(new Error(`Embeddings generation failed with code ${code}`));
          }
        });

        embeddingsProcess.on('error', reject);
      });

      if (!options.test) {
        console.log('\n✅ Embeddings generation completed!');
        console.log('💡 Next steps:');
        console.log('  • Start Qdrant: docker run -p 6333:6333 qdrant/qdrant');
        console.log('  • Store in Qdrant: privmx-docs qdrant');
        console.log('  • Test semantic search: privmx-docs embeddings --test');
        console.log(
          '  • Start MCP server with vector search: privmx-docs start'
        );
      }
    } catch (error) {
      console.error(
        '❌ Embeddings generation failed:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Qdrant vector database command (Phase 5)
 */
program
  .command('qdrant')
  .description('Store embeddings in Qdrant vector database')
  .option('-f, --force', 'Force storage even if data already exists')
  .option('-t, --test', 'Test search functionality after storage')
  .option('-s, --stats', 'Show Qdrant statistics')
  .option('-c, --cleanup', 'Delete Qdrant collection')
  .action(async (options) => {
    try {
      // Check if embeddings exist
      const embeddingsFile = path.join(CLI_CONFIG.dataPath, 'embeddings.json');
      try {
        await fs.access(embeddingsFile);
      } catch {
        console.log('❌ No embeddings found. Generate embeddings first:');
        console.log('   privmx-docs embeddings');
        return;
      }

      // Run the Qdrant storage script
      const qdrantPath = path.join(
        __dirname,
        '../../../packages/mcp-server/src/scripts/store-in-qdrant.ts'
      );

      const args = ['tsx', qdrantPath];
      if (options.force) args.push('--force');
      if (options.test) args.push('--test');
      if (options.stats) args.push('--stats');
      if (options.cleanup) args.push('--cleanup');

      console.log('🔄 Processing Qdrant storage...');

      const qdrantProcess = spawn(
        path.join(
          __dirname,
          '../../../packages/mcp-server/node_modules/.bin/tsx'
        ),
        [
          qdrantPath,
          ...(options.force ? ['--force'] : []),
          ...(options.test ? ['--test'] : []),
          ...(options.stats ? ['--stats'] : []),
          ...(options.cleanup ? ['--cleanup'] : []),
        ],
        {
          stdio: 'inherit',
          cwd: path.join(__dirname, '../../../packages/mcp-server'),
          env: { ...process.env },
        }
      );

      await new Promise((resolve, reject) => {
        qdrantProcess.on('close', (code) => {
          if (code === 0) {
            resolve(code);
          } else {
            reject(new Error(`Qdrant storage failed with code ${code}`));
          }
        });

        qdrantProcess.on('error', reject);
      });

      if (!options.stats && !options.cleanup && !options.test) {
        console.log('\n✅ Qdrant storage completed!');
        console.log('💡 Next steps:');
        console.log('  • Test search: privmx-docs qdrant --test');
        console.log('  • View stats: privmx-docs qdrant --stats');
        console.log('  • Start MCP server: privmx-docs start');
      }
    } catch (error) {
      console.error(
        '❌ Qdrant operation failed:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Clean command
 */
program
  .command('clean')
  .description('Clean processed documentation data')
  .option('-f, --force', 'Force deletion without confirmation')
  .option('-e, --embeddings', 'Also clean embeddings data')
  .option('-q, --qdrant', 'Also clean Qdrant vector database')
  .action(async (options) => {
    try {
      const dataExists = await fs
        .access(CLI_CONFIG.dataPath)
        .then(() => true)
        .catch(() => false);

      if (!dataExists) {
        console.log('✅ No data to clean.');
        return;
      }

      if (!options.force) {
        console.log('⚠️  This will delete all processed documentation data.');
        if (options.embeddings) {
          console.log('   Including embeddings and tracking database.');
        }
        if (options.qdrant) {
          console.log('   Including Qdrant vector database collection.');
        }
        console.log('   Use --force to confirm deletion.');
        return;
      }

      console.log('🧹 Cleaning processed data...');

      if (options.embeddings) {
        // Clean specific files
        const filesToClean = [
          'processed-chunks.json',
          'indexing-summary.json',
          'embeddings.json',
          'embeddings-summary.json',
          'embeddings-tracker.db',
          'qdrant-storage-summary.json',
        ];

        for (const file of filesToClean) {
          const filePath = path.join(CLI_CONFIG.dataPath, file);
          try {
            await fs.unlink(filePath);
            console.log(`  🗑️  Deleted ${file}`);
          } catch (error) {
            // File doesn't exist, ignore
          }
        }
      } else {
        await fs.rm(CLI_CONFIG.dataPath, { recursive: true, force: true });
      }

      // Clean Qdrant collection if requested
      if (options.qdrant) {
        try {
          const qdrantPath = path.join(
            __dirname,
            '../../../packages/mcp-server/src/scripts/store-in-qdrant.ts'
          );

          const qdrantProcess = spawn(
            path.join(
              __dirname,
              '../../../packages/mcp-server/node_modules/.bin/tsx'
            ),
            [qdrantPath, '--cleanup'],
            {
              stdio: 'inherit',
              cwd: path.join(__dirname, '../../../packages/mcp-server'),
              env: { ...process.env },
            }
          );

          await new Promise((resolve, reject) => {
            qdrantProcess.on('close', (code) => {
              if (code === 0) {
                resolve(code);
              } else {
                reject(new Error(`Qdrant cleanup failed with code ${code}`));
              }
            });

            qdrantProcess.on('error', reject);
          });
        } catch (error) {
          console.warn(
            '⚠️  Qdrant cleanup failed:',
            error instanceof Error ? error.message : error
          );
        }
      }

      console.log('✅ Data cleaned successfully.');
    } catch (error) {
      console.error(
        '❌ Failed to clean data:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
