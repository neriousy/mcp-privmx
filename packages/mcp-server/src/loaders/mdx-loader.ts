import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';
import { MarkdownTextSplitter } from '@langchain/textsplitters';
import fs from 'fs/promises';
import { LoaderOptions, DocumentMetadata } from './types.js';

export class MDXLoader extends BaseDocumentLoader {
  constructor(
    private filePath: string,
    private options: LoaderOptions = {}
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');

      // Use LangChain's MarkdownTextSplitter for intelligent splitting
      const splitter = new MarkdownTextSplitter({
        chunkSize: this.options.chunkSize ?? 1000,
        chunkOverlap: this.options.chunkOverlap ?? 200,
      });

      const chunks = await splitter.splitText(content);
      const documents: Document[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const metadata = this.extractMetadata(content, chunk, i);
        documents.push(new Document({ pageContent: chunk, metadata }));
      }

      return documents;
    } catch (error) {
      throw new Error(`Failed to load MDX file: ${error}`);
    }
  }

  private extractMetadata(
    fullContent: string,
    chunk: string,
    chunkIndex: number
  ): DocumentMetadata {
    const metadata: DocumentMetadata = {
      source: this.filePath,
      type: 'mdx',
      chunkIndex,
    };

    // Extract headers from the chunk
    const headers = this.extractHeaders(chunk);
    if (headers.length > 0) {
      metadata.headers = headers;
      metadata.title = headers[0]; // Use the first header as title
    }

    // Extract code blocks if option is enabled
    if (this.options.preserveCodeBlocks) {
      const codeBlocks = this.extractCodeBlocks(chunk);
      if (codeBlocks.length > 0) {
        metadata.codeBlocks = codeBlocks;
      }
    }

    // Add file metadata
    metadata.lastModified = new Date();
    metadata.size = chunk.length;

    return metadata;
  }

  private extractHeaders(content: string): string[] {
    const headerRegex = /^#{1,6}\s+(.+)$/gm;
    const headers: string[] = [];
    let match;

    while ((match = headerRegex.exec(content)) !== null) {
      headers.push(match[1].trim());
    }

    return headers;
  }

  private extractCodeBlocks(content: string): string[] {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push(match[0]);
    }

    return codeBlocks;
  }
}
