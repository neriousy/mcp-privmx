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

  private processSchemas(schemas: Record<string, unknown>): Document[] {
    const documents: Document[] = [];

    for (const [schemaName, schema] of Object.entries(schemas)) {
      const metadata: DocumentMetadata = {
        source: this.filePath,
        type: 'json-api',
        className: schemaName,
        namespace: 'schemas',
        ...this.getFileMetadata(),
      };

      const content = this.formatSchemaContent(
        schemaName,
        schema as Record<string, unknown>
      );
      documents.push(new Document({ pageContent: content, metadata }));
    }

    return documents;
  }

  private processPaths(paths: Record<string, unknown>): Document[] {
    const documents: Document[] = [];

    for (const [pathName, pathData] of Object.entries(paths)) {
      for (const [method, methodData] of Object.entries(
        pathData as Record<string, unknown>
      )) {
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
          methodData as Record<string, unknown>
        );
        documents.push(new Document({ pageContent: content, metadata }));
      }
    }

    return documents;
  }

  private processInfo(info: Record<string, unknown>): Document {
    const metadata: DocumentMetadata = {
      source: this.filePath,
      type: 'json-api',
      title: info.title as string,
      namespace: 'info',
      ...this.getFileMetadata(),
    };

    const content = `# ${info.title || 'Untitled'}\n\n${info.description || ''}\n\nVersion: ${info.version || 'N/A'}`;
    return new Document({ pageContent: content, metadata });
  }

  private formatSchemaContent(
    name: string,
    schema: Record<string, unknown>
  ): string {
    let content = `# Schema: ${name}\n\n`;

    if (schema.description) {
      content += `${schema.description}\n\n`;
    }

    if (schema.type) {
      content += `**Type**: ${schema.type}\n\n`;
    }

    if (schema.properties) {
      content += '## Properties\n\n';
      for (const [propName, propData] of Object.entries(
        schema.properties as Record<string, unknown>
      )) {
        const prop = propData as Record<string, unknown>;
        content += `### ${propName}\n`;
        content += `- **Type**: ${prop.type || 'unknown'}\n`;
        if (prop.description) {
          content += `- **Description**: ${prop.description}\n`;
        }
        content += '\n';
      }
    }

    if (schema.required && Array.isArray(schema.required)) {
      content += `**Required fields**: ${(schema.required as string[]).join(', ')}\n\n`;
    }

    return content;
  }

  private formatPathContent(
    path: string,
    method: string,
    data: Record<string, unknown>
  ): string {
    let content = `# ${method.toUpperCase()} ${path}\n\n`;

    if (data.summary) {
      content += `${data.summary}\n\n`;
    }

    if (data.description) {
      content += `${data.description}\n\n`;
    }

    if (data.parameters && Array.isArray(data.parameters)) {
      content += '## Parameters\n\n';
      for (const param of data.parameters as Array<Record<string, unknown>>) {
        content += `### ${param.name || 'unknown'}\n`;
        const schema = param.schema as Record<string, unknown> | undefined;
        content += `- **Type**: ${schema?.type || 'unknown'}\n`;
        content += `- **Location**: ${param.in || 'unknown'}\n`;
        content += `- **Required**: ${param.required ? 'Yes' : 'No'}\n`;
        if (param.description) {
          content += `- **Description**: ${param.description}\n`;
        }
        content += '\n';
      }
    }

    if (data.responses) {
      content += '## Responses\n\n';
      for (const [code, response] of Object.entries(
        data.responses as Record<string, unknown>
      )) {
        const resp = response as Record<string, unknown>;
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
    const _stats = path.parse(this.filePath);
    return {
      lastModified: new Date(),
      size: 0, // Will be set when file stats are available
    };
  }
}
