import { Document } from '@langchain/core/documents';
import { JSONAPILoader } from './json-api-loader.js';
import { MDXLoader } from './mdx-loader.js';
import { LoaderOptions } from './types.js';
import path from 'path';

export class DocumentProcessor {
  constructor(private options: LoaderOptions = {}) {}

  async processDocument(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return this.processJSON(filePath);
      case '.mdx':
      case '.md':
        return this.processMDX(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  async processDirectory(dirPath: string): Promise<Document[]> {
    const fs = await import('fs/promises');
    const files = await fs.readdir(dirPath, { recursive: true });
    const documents: Document[] = [];

    for (const file of files) {
      if (typeof file === 'string') {
        const fullPath = path.join(dirPath, file);
        const stat = await fs.stat(fullPath);

        if (stat.isFile()) {
          try {
            const fileDocs = await this.processDocument(fullPath);
            documents.push(...fileDocs);
          } catch (error) {
            console.warn(`Failed to process ${fullPath}: ${error}`);
          }
        }
      }
    }

    return documents;
  }

  private async processJSON(filePath: string): Promise<Document[]> {
    const loader = new JSONAPILoader(filePath, this.options);
    return loader.load();
  }

  private async processMDX(filePath: string): Promise<Document[]> {
    const loader = new MDXLoader(filePath, this.options);
    return loader.load();
  }
}
