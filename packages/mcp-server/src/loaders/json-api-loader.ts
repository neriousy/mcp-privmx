/**
 * PrivMX JSON API Document Loader
 *
 * Uses LangChain's document loading framework to parse JSON API specifications
 * and create properly structured documents with metadata.
 */

import { Document } from '@langchain/core/documents';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import fs from 'fs/promises';
import path from 'path';
import { LoaderOptions, DocumentMetadata } from './types.js';

export class JSONAPILoader extends BaseDocumentLoader {
  constructor(
    private filePath: string,
    private options: LoaderOptions = {}
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const jsonData = JSON.parse(content);

      const documents: Document[] = [];

      // Process JSON API documentation structure
      if (jsonData.components?.schemas) {
        documents.push(...this.processSchemas(jsonData.components.schemas));
      }

      if (jsonData.paths) {
        documents.push(...this.processPaths(jsonData.paths));
      }

      if (jsonData.info) {
        documents.push(this.processInfo(jsonData.info));
      }

      return documents;
    } catch (error) {
      throw new Error(`Failed to load JSON API file: ${error}`);
    }
  }

  private processSchemas(schemas: any): Document[] {
    const documents: Document[] = [];

    for (const [schemaName, schema] of Object.entries(schemas)) {
      const metadata: DocumentMetadata = {
        source: this.filePath,
        type: 'json-api',
        className: schemaName,
        namespace: 'schemas',
        ...this.getFileMetadata(),
      };

      const content = this.formatSchemaContent(schemaName, schema as any);
      documents.push(new Document({ pageContent: content, metadata }));
    }

    return documents;
  }

  private processPaths(paths: any): Document[] {
    const documents: Document[] = [];

    for (const [pathName, pathData] of Object.entries(paths)) {
      for (const [method, methodData] of Object.entries(pathData as any)) {
        const metadata: DocumentMetadata = {
          source: this.filePath,
          type: 'json-api',
          methodName: `${method.toUpperCase()} ${pathName}`,
          namespace: 'paths',
          ...this.getFileMetadata(),
        };

        const content = this.formatPathContent(
          pathName,
          method,
          methodData as any
        );
        documents.push(new Document({ pageContent: content, metadata }));
      }
    }

    return documents;
  }

  private processInfo(info: any): Document {
    const metadata: DocumentMetadata = {
      source: this.filePath,
      type: 'json-api',
      title: info.title,
      namespace: 'info',
      ...this.getFileMetadata(),
    };

    const content = `# ${info.title}\n\n${info.description || ''}\n\nVersion: ${info.version || 'N/A'}`;
    return new Document({ pageContent: content, metadata });
  }

  private formatSchemaContent(name: string, schema: any): string {
    let content = `# Schema: ${name}\n\n`;

    if (schema.description) {
      content += `${schema.description}\n\n`;
    }

    if (schema.type) {
      content += `**Type**: ${schema.type}\n\n`;
    }

    if (schema.properties) {
      content += '## Properties\n\n';
      for (const [propName, propData] of Object.entries(schema.properties)) {
        const prop = propData as any;
        content += `### ${propName}\n`;
        content += `- **Type**: ${prop.type || 'unknown'}\n`;
        if (prop.description) {
          content += `- **Description**: ${prop.description}\n`;
        }
        content += '\n';
      }
    }

    if (schema.required) {
      content += `**Required fields**: ${schema.required.join(', ')}\n\n`;
    }

    return content;
  }

  private formatPathContent(path: string, method: string, data: any): string {
    let content = `# ${method.toUpperCase()} ${path}\n\n`;

    if (data.summary) {
      content += `${data.summary}\n\n`;
    }

    if (data.description) {
      content += `${data.description}\n\n`;
    }

    if (data.parameters) {
      content += '## Parameters\n\n';
      for (const param of data.parameters) {
        content += `### ${param.name}\n`;
        content += `- **Type**: ${param.schema?.type || 'unknown'}\n`;
        content += `- **Location**: ${param.in}\n`;
        content += `- **Required**: ${param.required ? 'Yes' : 'No'}\n`;
        if (param.description) {
          content += `- **Description**: ${param.description}\n`;
        }
        content += '\n';
      }
    }

    if (data.responses) {
      content += '## Responses\n\n';
      for (const [code, response] of Object.entries(data.responses)) {
        const resp = response as any;
        content += `### ${code}\n`;
        if (resp.description) {
          content += `${resp.description}\n`;
        }
        content += '\n';
      }
    }

    return content;
  }

  private getFileMetadata() {
    const stats = path.parse(this.filePath);
    return {
      lastModified: new Date(),
      size: 0, // Will be set when file stats are available
    };
  }
}
