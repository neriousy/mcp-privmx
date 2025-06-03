/**
 * JSON API Reference Parser
 * Parses structured JSON API documentation from PrivMX spec
 */

import type {
  ParsedContent,
  ChunkMetadata,
  CodeExample,
  Parameter,
  ReturnValue,
} from '@privmx/shared';

interface JSONMethod {
  type: 'method';
  name: string;
  description: string;
  snippet: string;
  methodType: string;
  params: JSONParameter[];
  returns: JSONReturn[] | null;
}

interface JSONParameter {
  name: string;
  description: string;
  type: {
    name: string;
    optional: boolean;
  };
}

interface JSONReturn {
  type: {
    name: string;
    optional: boolean;
  };
  description: string;
}

interface JSONClass {
  type: 'class';
  name: string;
  description: string;
  fields: any[];
  methods: JSONMethod[];
}

interface JSONType {
  type: 'type';
  name: string;
  description: string;
  snippet: string;
  fields: JSONField[];
  generic: any[];
}

interface JSONField {
  name: string;
  description: string;
  type: {
    name: string;
    optional: boolean;
  };
}

interface JSONNamespace {
  title: string;
  content: (JSONClass | JSONType)[];
  namespace: string;
}

interface JSONAPISpec {
  [namespace: string]:
    | JSONNamespace[]
    | {
        version: string;
        package: string;
        lang: string;
        name: string;
      };
  _meta: {
    version: string;
    package: string;
    lang: string;
    name: string;
  };
}

export class JSONParser {
  /**
   * Parse complete JSON API specification
   */
  async parseSpec(jsonContent: string): Promise<ParsedContent[]> {
    try {
      const spec: JSONAPISpec = JSON.parse(jsonContent);
      const parsedContent: ParsedContent[] = [];

      // Parse each namespace
      for (const [namespaceName, namespaceData] of Object.entries(spec)) {
        if (namespaceName === '_meta') continue;

        // Type guard to ensure we're working with namespace data
        if (Array.isArray(namespaceData)) {
          for (const section of namespaceData) {
            const sectionContent = await this.parseNamespaceSection(
              section,
              namespaceName
            );
            parsedContent.push(...sectionContent);
          }
        }
      }

      return parsedContent;
    } catch (error) {
      throw new Error(`Failed to parse JSON API spec: ${error}`);
    }
  }

  /**
   * Parse a namespace section (e.g., Core, Threads, Stores)
   */
  private async parseNamespaceSection(
    section: JSONNamespace,
    namespaceName: string
  ): Promise<ParsedContent[]> {
    const parsedContent: ParsedContent[] = [];

    for (const item of section.content) {
      if (item.type === 'class') {
        const classContent = await this.parseClass(item, namespaceName);
        parsedContent.push(...classContent);
      } else if (item.type === 'type') {
        const typeContent = await this.parseType(item, namespaceName);
        parsedContent.push(typeContent);
      }
    }

    return parsedContent;
  }

  /**
   * Parse a class and its methods
   */
  private async parseClass(
    classItem: JSONClass,
    namespaceName: string
  ): Promise<ParsedContent[]> {
    const parsedContent: ParsedContent[] = [];

    // Parse the class itself
    const classMetadata: ChunkMetadata = {
      type: 'class',
      namespace: namespaceName,
      className: classItem.name,
      importance: this.determineImportance(classItem.name, namespaceName),
      tags: [
        namespaceName.toLowerCase(),
        'class',
        classItem.name.toLowerCase(),
      ],
      sourceFile: 'spec/out.js.json',
    };

    const classContent: ParsedContent = {
      type: 'class',
      name: classItem.name,
      description: classItem.description,
      content: this.buildClassContent(classItem),
      metadata: classMetadata,
    };

    parsedContent.push(classContent);

    // Parse each method in the class
    for (const method of classItem.methods) {
      const methodContent = await this.parseMethod(
        method,
        classItem.name,
        namespaceName
      );
      parsedContent.push(methodContent);
    }

    return parsedContent;
  }

  /**
   * Parse a method
   */
  private async parseMethod(
    method: JSONMethod,
    className: string,
    namespaceName: string
  ): Promise<ParsedContent> {
    const methodMetadata: ChunkMetadata = {
      type: 'method',
      namespace: namespaceName,
      className,
      methodName: method.name,
      importance: this.determineMethodImportance(method.name, className),
      tags: [
        namespaceName.toLowerCase(),
        'method',
        className.toLowerCase(),
        method.name.toLowerCase(),
      ],
      sourceFile: 'spec/out.js.json',
      dependencies: this.extractDependencies(method),
      commonMistakes: this.getCommonMistakes(method.name),
      useCases: this.getUseCases(method.name, className),
    };

    const parameters: Parameter[] = method.params.map((param) => ({
      name: param.name,
      description: param.description,
      type: {
        name: param.type.name,
        optional: param.type.optional || false,
      },
    }));

    const returns: ReturnValue[] =
      method.returns?.map((ret) => ({
        type: {
          name: ret.type.name,
          optional: ret.type.optional || false,
        },
        description: ret.description,
      })) || [];

    const examples: CodeExample[] = [
      {
        language: 'javascript',
        code: this.generateBasicExample(method, className),
        explanation: `Basic usage of ${className}.${method.name}()`,
        title: `${method.name} Example`,
      },
    ];

    return {
      type: 'method',
      name: `${className}.${method.name}`,
      description: method.description,
      content: this.buildMethodContent(method, className),
      metadata: methodMetadata,
      parameters,
      returns,
      examples,
    };
  }

  /**
   * Parse a type definition
   */
  private async parseType(
    typeItem: JSONType,
    namespaceName: string
  ): Promise<ParsedContent> {
    const typeMetadata: ChunkMetadata = {
      type: 'class', // Types are treated as classes for now
      namespace: namespaceName,
      className: typeItem.name,
      importance: 'medium',
      tags: [namespaceName.toLowerCase(), 'type', typeItem.name.toLowerCase()],
      sourceFile: 'spec/out.js.json',
    };

    return {
      type: 'class',
      name: typeItem.name,
      description: typeItem.description,
      content: this.buildTypeContent(typeItem),
      metadata: typeMetadata,
    };
  }

  /**
   * Build enhanced content for a class
   */
  private buildClassContent(classItem: JSONClass): string {
    const methods = classItem.methods.map((m) => `- ${m.name}()`).join('\n');

    return `
# ${classItem.name}

${classItem.description}

## Available Methods:
${methods}

## Class Type: ${classItem.type}
## Namespace: Core API

This class provides core functionality for PrivMX operations.
    `.trim();
  }

  /**
   * Build enhanced content for a method
   */
  private buildMethodContent(method: JSONMethod, className: string): string {
    const params = method.params
      .map(
        (p) =>
          `- \`${p.name}\` (${p.type.name}${p.type.optional ? '?' : ''}): ${p.description}`
      )
      .join('\n');

    const returns =
      method.returns
        ?.map((r) => `- ${r.type.name}: ${r.description}`)
        .join('\n') || 'void';

    return `
# ${className}.${method.name}()

${method.description}

## Signature
\`\`\`javascript
${method.snippet}
\`\`\`

## Parameters
${params || 'No parameters'}

## Returns
${returns}

## Method Type: ${method.methodType}

## Prerequisites
- Must have active connection to PrivMX Bridge
- Required permissions for this operation
- Valid authentication context

## Common Usage Pattern
This method is typically used in the context of ${this.getMethodContext(method.name, className)}.
    `.trim();
  }

  /**
   * Build content for a type definition
   */
  private buildTypeContent(typeItem: JSONType): string {
    const fields = typeItem.fields
      .map(
        (f) =>
          `- \`${f.name}\` (${f.type.name}${f.type.optional ? '?' : ''}): ${f.description}`
      )
      .join('\n');

    return `
# ${typeItem.name}

${typeItem.description}

## Type Definition
\`\`\`typescript
${typeItem.snippet}
\`\`\`

## Fields
${fields || 'No fields defined'}

This type is used throughout the PrivMX API for structured data handling.
    `.trim();
  }

  /**
   * Determine importance level based on class/method name
   */
  private determineImportance(
    name: string,
    namespace: string
  ): ChunkMetadata['importance'] {
    const criticalClasses = ['Endpoint', 'Connection'];
    const criticalMethods = [
      'setup',
      'connect',
      'createThreadApi',
      'createStoreApi',
    ];

    if (criticalClasses.includes(name)) return 'critical';
    if (criticalMethods.some((method) => name.includes(method)))
      return 'critical';
    if (['Core'].includes(namespace)) return 'high';

    return 'medium';
  }

  /**
   * Determine method importance
   */
  private determineMethodImportance(
    methodName: string,
    className: string
  ): ChunkMetadata['importance'] {
    const criticalMethods = ['setup', 'connect', 'create', 'get'];
    const highMethods = ['list', 'update', 'delete'];

    if (
      criticalMethods.some((critical) =>
        methodName.toLowerCase().includes(critical)
      )
    ) {
      return 'critical';
    }
    if (highMethods.some((high) => methodName.toLowerCase().includes(high))) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Extract dependencies from method parameters
   */
  private extractDependencies(method: JSONMethod): string[] {
    const deps: string[] = [];

    // Common dependencies based on parameter types
    method.params.forEach((param) => {
      if (param.type.name === 'Connection') deps.push('Endpoint.connect()');
      if (param.type.name.includes('Api'))
        deps.push(`Endpoint.create${param.type.name}()`);
    });

    return deps;
  }

  /**
   * Get common mistakes for specific methods
   */
  private getCommonMistakes(methodName: string): string[] {
    const mistakes: Record<string, string[]> = {
      setup: ['Forgetting to await', 'Missing WASM assets path'],
      connect: ['Invalid private key format', 'Wrong bridge URL'],
      createThread: ['Empty users array', 'Missing manager permissions'],
      sendMessage: ['Data not serialized', 'Missing thread access'],
    };

    return mistakes[methodName] || [];
  }

  /**
   * Get use cases for methods
   */
  private getUseCases(methodName: string, className: string): string[] {
    const useCases: Record<string, string[]> = {
      setup: ['Application initialization', 'Library configuration'],
      connect: ['User authentication', 'Bridge connection'],
      createThread: ['Group messaging', 'Collaborative workspace'],
      sendMessage: ['Chat messages', 'Notifications'],
    };

    return useCases[methodName] || [`${className} operations`];
  }

  /**
   * Get method context description
   */
  private getMethodContext(methodName: string, className: string): string {
    const contexts: Record<string, string> = {
      setup: 'application initialization and library preparation',
      connect: 'establishing secure connection to PrivMX Bridge',
      createThread: 'setting up encrypted communication channels',
      sendMessage: 'real-time messaging and data exchange',
    };

    return contexts[methodName] || `${className} management operations`;
  }

  /**
   * Generate basic usage example
   */
  private generateBasicExample(method: JSONMethod, className: string): string {
    const paramNames = method.params
      .map((p) => {
        if (p.type.name === 'string') return `"${p.name}"`;
        if (p.type.name === 'number') return '0';
        if (p.type.name === 'boolean') return 'true';
        if (p.type.name.includes('[]')) return '[]';
        return p.name;
      })
      .join(', ');

    const hasReturn = method.returns && method.returns.length > 0;
    const returnPrefix = hasReturn ? 'const result = ' : '';
    const awaitPrefix = method.methodType === 'method' ? 'await ' : '';

    return `${returnPrefix}${awaitPrefix}${className}.${method.name}(${paramNames});`;
  }
}
