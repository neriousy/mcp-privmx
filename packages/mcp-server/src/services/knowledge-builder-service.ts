import * as fs from 'fs/promises';
import * as path from 'path';
import { APIParser } from '../api/parser.js';
import { SearchService } from './search-service.js';
import logger from '../common/logger.js';

export class KnowledgeBuilderService {
  private apiParser: APIParser;

  constructor() {
    this.apiParser = new APIParser();
  }

  public async buildKnowledgeGraph(
    specPath: string,
    searchService: SearchService,
    apiData: Map<string, unknown>
  ): Promise<void> {
    logger.info(`   🔍 Looking for API spec files in: ${specPath}`);

    const manifestFiles = await this.findManifestFiles(specPath);
    logger.info(
      `   📁 Found ${manifestFiles.length} manifest files:`,
      manifestFiles
    );

    if (manifestFiles.length === 0) {
      logger.warn(
        `   ⚠️  No privmx.spec.json files found in ${specPath}. Check the path!`
      );
      return;
    }

    for (const manifestFile of manifestFiles) {
      try {
        logger.info(`   📄 Processing manifest: ${manifestFile}`);
        const manifestContent = await fs.readFile(manifestFile, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        const language = manifest.language;

        if (!language) {
          logger.warn(
            `   ⚠️  Manifest ${manifestFile} is missing language property.`
          );
          continue;
        }

        logger.info(`   🔤 Detected language: ${language}`);

        const specDir = path.dirname(manifestFile);
        const apiFiles = (await fs.readdir(specDir)).filter(
          (f) => f.endsWith('.json') && f !== 'privmx.spec.json'
        );

        for (const apiFile of apiFiles) {
          const apiFilePath = path.join(specDir, apiFile);
          const content = await fs.readFile(apiFilePath, 'utf-8');
          const namespaces = await this.apiParser.parseAPISpec(
            content,
            language,
            apiFilePath
          );

          logger.info(
            `   📊 Parsed ${namespaces.length} namespaces from ${apiFilePath}`
          );

          for (const namespace of namespaces) {
            searchService.addNamespace(namespace, language);
            const key = `${language}:${namespace.name}`;
            apiData.set(key, namespace);
            logger.info(
              `   ✅ Added namespace: ${key} (${namespace.classes.length} classes, ${namespace.functions.length} functions)`
            );
          }
        }
      } catch (error) {
        logger.warn(`   ⚠️ Failed to process manifest ${manifestFile}:`, error);
      }
    }
  }

  private async findManifestFiles(basePath: string): Promise<string[]> {
    const files: string[] = [];
    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== 'node_modules') {
            await walkDir(fullPath);
          } else if (entry.isFile() && entry.name === 'privmx.spec.json') {
            files.push(fullPath);
          }
        }
      } catch (error) {
        logger.warn(`Cannot read directory ${dir}:`, error);
      }
    };
    await walkDir(basePath);
    return files;
  }
}
