/**
 * KnowledgeBuilder - Builds knowledge graph from PrivMX specifications
 *
 * Extracts and processes API specifications from JSON and MDX files
 * to create a structured knowledge graph for AI agents.
 */

import path from 'path';
import { APIParser } from '../../api/parser.js';
import { specRoot } from '../../common/paths.js';

export class KnowledgeBuilder {
  private apiParser: APIParser;

  constructor() {
    this.apiParser = new APIParser();
  }

  /**
   * Build knowledge graph from specification files
   */
  async buildFromSpecifications(
    specPath: string
  ): Promise<Map<string, unknown>> {
    const apiData = new Map<string, unknown>();
    const resolvedSpecPath = path.resolve(specRoot, specPath);

    try {
      console.log('🔨 Building knowledge graph from specifications...');

      // Find and process API specification files
      const manifestFiles = await this.findManifestFiles(resolvedSpecPath);
      console.log(`📋 Found ${manifestFiles.length} specification files`);

      let totalNamespaces = 0;
      let totalMethods = 0;

      for (const filePath of manifestFiles) {
        try {
          const content = await import('fs').then((fs) =>
            fs.promises.readFile(filePath, 'utf-8')
          );

          // Determine language from file path
          const language = this.extractLanguageFromPath(filePath);

          // Parse the specification file
          const namespaces = await this.apiParser.parseAPISpec(
            content,
            language,
            filePath
          );

          // Store in API data map
          const key = `${language}-${path.basename(filePath, '.json')}`;
          apiData.set(key, namespaces);

          totalNamespaces += namespaces.length;
          totalMethods += namespaces.reduce(
            (sum, ns) =>
              sum +
              ns.functions.length +
              ns.classes.reduce(
                (clsSum, cls) =>
                  clsSum +
                  cls.methods.length +
                  cls.staticMethods.length +
                  cls.constructors.length,
                0
              ),
            0
          );

          console.log(
            `  ✅ Processed ${filePath}: ${namespaces.length} namespaces`
          );
        } catch (error) {
          console.error(`  ❌ Failed to process ${filePath}:`, error);
        }
      }

      console.log(
        `🎯 Knowledge graph built: ${totalNamespaces} namespaces, ${totalMethods} methods`
      );
      return apiData;
    } catch (error) {
      console.error('❌ Failed to build knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Find all manifest/specification files in the spec directory
   */
  private async findManifestFiles(basePath: string): Promise<string[]> {
    const manifestFiles: string[] = [];
    const fs = await import('fs');

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile() && this.isSpecificationFile(entry.name)) {
            manifestFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not read directory ${dir}:`, error);
      }
    };

    await walkDir(basePath);
    return manifestFiles;
  }

  /**
   * Check if file is a specification file we should process
   */
  private isSpecificationFile(filename: string): boolean {
    return (
      filename.endsWith('.json') &&
      (filename.includes('spec') ||
        filename.includes('privmx') ||
        filename.includes('endpoint'))
    );
  }

  /**
   * Extract programming language from file path
   */
  private extractLanguageFromPath(filePath: string): string {
    const pathParts = filePath.split(path.sep);

    // Look for language indicators in path
    for (const part of pathParts) {
      if (['js', 'javascript'].includes(part.toLowerCase()))
        return 'javascript';
      if (['ts', 'typescript'].includes(part.toLowerCase()))
        return 'typescript';
      if (['java'].includes(part.toLowerCase())) return 'java';
      if (['swift'].includes(part.toLowerCase())) return 'swift';
      if (['cpp', 'c++'].includes(part.toLowerCase())) return 'cpp';
      if (['csharp', 'c#'].includes(part.toLowerCase())) return 'csharp';
      if (['kotlin'].includes(part.toLowerCase())) return 'kotlin';
    }

    return 'unknown';
  }
}
