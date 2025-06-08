/**
 * API Parser - Convert JSON API specifications into structured knowledge
 */

import {
  APIMethod,
  APIClass,
  APINamespace,
  APIParameter,
  APIType,
  APIReturnType,
  APIProperty,
  CodeExample,
} from './types.js';

/**
 * Raw JSON API structure (as parsed from spec files)
 */
interface RawAPISpec {
  [namespace: string]: Array<{
    title: string;
    content: Array<{
      type: 'class' | 'method' | 'function' | 'constant';
      name: string;
      description: string;
      fields?: any[];
      methods?: RawMethod[];
      snippet?: string;
      methodType?: string;
      params?: RawParameter[];
      returns?: RawReturn[];
    }>;
  }>;
}

interface RawMethod {
  type: 'method';
  name: string;
  description: string;
  snippet: string;
  methodType: 'method' | 'static' | 'constructor';
  params: RawParameter[];
  returns: RawReturn[];
}

interface RawParameter {
  name: string;
  description: string;
  type: {
    name: string;
    optional: boolean;
  };
}

interface RawReturn {
  type: {
    name: string;
    optional: boolean;
  };
  description: string;
}

export class APIParser {
  /**
   * Parse a JSON API specification file into structured knowledge
   */
  async parseAPISpec(
    jsonContent: string,
    language: string,
    filePath: string
  ): Promise<APINamespace[]> {
    const spec: RawAPISpec = JSON.parse(jsonContent);
    const namespaces: APINamespace[] = [];

    console.log(`📊 Parsing ${filePath}:`);
    console.log(`   📋 Found namespaces: ${Object.keys(spec).join(', ')}`);

    for (const [namespaceName, namespaceContent] of Object.entries(spec)) {
      console.log(`   🔍 Processing namespace: ${namespaceName}`);
      console.log(
        `   📊 Content type: ${typeof namespaceContent}, length: ${Array.isArray(namespaceContent) ? namespaceContent.length : 'N/A'}`
      );

      const namespace = await this.parseNamespace(
        namespaceName,
        namespaceContent,
        language,
        filePath
      );
      namespaces.push(namespace);
    }

    return namespaces;
  }

  /**
   * Parse a single namespace
   */
  private async parseNamespace(
    name: string,
    content: any[],
    language: string,
    filePath: string
  ): Promise<APINamespace> {
    const classes: APIClass[] = [];
    const functions: APIMethod[] = [];

    // The content is an array of sections with title and content
    if (!Array.isArray(content)) {
      console.warn(
        `Warning: content for namespace ${name} is not an array:`,
        typeof content
      );
      return {
        name,
        description: this.generateNamespaceDescription(name, language),
        language,
        classes: [],
        functions: [],
        constants: [],
        types: [],
        commonPatterns: [],
      };
    }

    for (const section of content) {
      if (section.content && Array.isArray(section.content)) {
        for (const item of section.content) {
          if (item.type === 'class') {
            const apiClass = await this.parseClass(
              item,
              name,
              language,
              filePath
            );
            classes.push(apiClass);
          } else if (item.type === 'method' || item.type === 'function') {
            const method = await this.parseMethod(
              item,
              name,
              language,
              undefined,
              filePath
            );
            functions.push(method);
          }
        }
      }
    }

    return {
      name,
      description: this.generateNamespaceDescription(name, language),
      language,
      classes,
      functions,
      constants: [], // TODO: Parse constants
      types: [], // TODO: Parse type definitions
      commonPatterns: this.inferCommonPatterns(classes, functions),
    };
  }

  /**
   * Parse a class definition
   */
  private async parseClass(
    classData: any,
    namespace: string,
    language: string,
    filePath: string
  ): Promise<APIClass> {
    const methods: APIMethod[] = [];
    const staticMethods: APIMethod[] = [];
    const constructors: APIMethod[] = [];

    if (classData.methods) {
      for (const methodData of classData.methods) {
        const method = await this.parseMethod(
          methodData,
          namespace,
          language,
          classData.name,
          filePath
        );

        if (method.methodType === 'constructor') {
          constructors.push(method);
        } else if (method.methodType === 'static') {
          staticMethods.push(method);
        } else {
          methods.push(method);
        }
      }
    }

    return {
      name: classData.name,
      description: classData.description || `${classData.name} class`,
      namespace,
      language,
      methods,
      staticMethods,
      constructors,
      properties: [], // TODO: Parse properties from fields
      dependencies: this.inferDependencies(classData, language),
      usedWith: this.inferUsageRelationships(classData),
      creationPattern: this.generateCreationPattern(classData, language),
      commonWorkflows: this.inferWorkflows(classData),
    };
  }

  /**
   * Parse a method definition
   */
  private async parseMethod(
    methodData: any,
    namespace: string,
    language: string,
    className?: string,
    filePath?: string
  ): Promise<APIMethod> {
    const parameters = this.parseParameters(methodData.params || []);
    const returns = this.parseReturns(methodData.returns || []);

    return {
      name: methodData.name,
      description: methodData.description,
      snippet:
        methodData.snippet || this.generateSnippet(methodData, parameters),
      methodType: methodData.methodType || 'method',
      parameters,
      returns,
      language,
      namespace,
      className,
      prerequisites: this.inferPrerequisites(methodData, className),
      relatedMethods: this.inferRelatedMethods(methodData),
      usagePatterns: this.inferUsagePatterns(methodData),
      errorHandling: this.inferErrorHandling(methodData),
      examples: await this.findExamples(methodData, language, filePath),
      validation: this.generateValidation(parameters),
    };
  }

  /**
   * Parse method parameters
   */
  private parseParameters(rawParams: RawParameter[] | null): APIParameter[] {
    if (!rawParams || !Array.isArray(rawParams)) {
      return [];
    }

    return rawParams.map((param) => ({
      name: param.name,
      description: param.description,
      type: this.parseType(param.type),
      optional: param.type.optional,
      defaultValue: undefined, // TODO: Extract from description if available
    }));
  }

  /**
   * Parse return types
   */
  private parseReturns(rawReturns: RawReturn[] | null): APIReturnType[] {
    if (!rawReturns || !Array.isArray(rawReturns)) {
      return [];
    }

    return rawReturns.map((ret) => ({
      type: this.parseType(ret.type),
      description: ret.description,
    }));
  }

  /**
   * Parse type information
   */
  private parseType(
    rawType: { name: string; optional: boolean } | undefined
  ): APIType {
    if (!rawType || !rawType.name) {
      return {
        name: 'unknown',
        optional: true,
      };
    }

    const typeName = rawType.name;

    // Handle generic types like Promise<Connection>
    const genericMatch = typeName.match(/^(\w+)<(.+)>$/);
    if (genericMatch) {
      const [, baseType, genericType] = genericMatch;
      return {
        name: baseType,
        optional: rawType.optional,
        generics: [{ name: genericType, optional: false }],
      };
    }

    // Handle array types
    if (typeName.endsWith('[]')) {
      return {
        name: typeName.slice(0, -2),
        optional: rawType.optional,
        isArray: true,
      };
    }

    return {
      name: typeName,
      optional: rawType.optional,
    };
  }

  /**
   * Generate method snippet if not provided
   */
  private generateSnippet(methodData: any, parameters: APIParameter[]): string {
    const paramNames = parameters.map((p) => p.name).join(', ');
    return `${methodData.name}(${paramNames})`;
  }

  /**
   * Infer method prerequisites (what must be called first)
   */
  private inferPrerequisites(methodData: any, className?: string): string[] {
    const prerequisites: string[] = [];

    // Common patterns
    if (methodData.name.includes('create') && className !== 'Endpoint') {
      prerequisites.push('connect');
    }

    if (
      methodData.name.includes('send') ||
      methodData.name.includes('update')
    ) {
      prerequisites.push('create');
    }

    // Connection-dependent methods
    if (
      className &&
      ['ThreadApi', 'StoreApi', 'InboxApi'].includes(className)
    ) {
      prerequisites.push('Endpoint.connect');
    }

    return prerequisites;
  }

  /**
   * Infer related methods (commonly used together)
   */
  private inferRelatedMethods(methodData: any): string[] {
    const related: string[] = [];

    // Common patterns
    if (methodData.name.includes('create')) {
      related.push('list', 'get', 'update', 'delete');
    }

    if (methodData.name.includes('send')) {
      related.push('list', 'get');
    }

    return related;
  }

  /**
   * Infer usage patterns
   */
  private inferUsagePatterns(methodData: any): string[] {
    const patterns: string[] = [];

    if (methodData.name.includes('create')) {
      patterns.push('crud-operations');
    }

    if (methodData.name.includes('connect')) {
      patterns.push('initialization');
    }

    if (
      methodData.name.includes('send') ||
      methodData.name.includes('message')
    ) {
      patterns.push('messaging');
    }

    if (
      methodData.name.includes('file') ||
      methodData.name.includes('upload')
    ) {
      patterns.push('file-handling');
    }

    return patterns;
  }

  /**
   * Infer error handling patterns
   */
  private inferErrorHandling(methodData: any): string[] {
    const errorHandling: string[] = [];

    // Network operations
    if (
      methodData.name.includes('connect') ||
      methodData.name.includes('send')
    ) {
      errorHandling.push('NetworkError', 'TimeoutError');
    }

    // Authentication
    if (
      methodData.name.includes('connect') ||
      methodData.name.includes('auth')
    ) {
      errorHandling.push('AuthenticationError', 'InvalidCredentialsError');
    }

    // File operations
    if (
      methodData.name.includes('file') ||
      methodData.name.includes('upload')
    ) {
      errorHandling.push('FileNotFoundError', 'FileSizeError');
    }

    return errorHandling;
  }

  /**
   * Find code examples for this method
   */
  private async findExamples(
    methodData: any,
    language: string,
    filePath?: string
  ): Promise<CodeExample[]> {
    // TODO: Cross-reference with MDX documentation
    // For now, return empty array - will be populated by workflow extractor
    return [];
  }

  /**
   * Generate parameter validation rules
   */
  private generateValidation(parameters: APIParameter[]): string[] {
    const validation: string[] = [];

    for (const param of parameters) {
      if (!param.optional) {
        validation.push(`${param.name} is required`);
      }

      if (param.type.name === 'string') {
        validation.push(`${param.name} must be a non-empty string`);
      }

      if (param.type.name.includes('Id')) {
        validation.push(`${param.name} must be a valid ID`);
      }
    }

    return validation;
  }

  /**
   * Generate namespace description
   */
  private generateNamespaceDescription(name: string, language: string): string {
    return `PrivMX ${name} API for ${language}`;
  }

  /**
   * Infer common patterns for a namespace
   */
  private inferCommonPatterns(
    classes: APIClass[],
    functions: APIMethod[]
  ): string[] {
    const patterns = new Set<string>();

    // Analyze all methods to find patterns
    for (const cls of classes) {
      for (const method of [...cls.methods, ...cls.staticMethods]) {
        method.usagePatterns.forEach((pattern) => patterns.add(pattern));
      }
    }

    for (const func of functions) {
      func.usagePatterns.forEach((pattern) => patterns.add(pattern));
    }

    return Array.from(patterns);
  }

  /**
   * Infer class dependencies
   */
  private inferDependencies(classData: any, language: string): string[] {
    const dependencies: string[] = [];

    // APIs typically depend on Connection
    if (classData.name.includes('Api')) {
      dependencies.push('Connection');
    }

    // Some APIs depend on others
    if (classData.name === 'InboxApi') {
      dependencies.push('ThreadApi', 'StoreApi');
    }

    return dependencies;
  }

  /**
   * Infer usage relationships
   */
  private inferUsageRelationships(classData: any): string[] {
    const related: string[] = [];

    if (classData.name === 'ThreadApi') {
      related.push('StoreApi', 'InboxApi');
    }

    if (classData.name === 'StoreApi') {
      related.push('ThreadApi');
    }

    return related;
  }

  /**
   * Generate creation pattern
   */
  private generateCreationPattern(classData: any, language: string): string {
    if (classData.name.includes('Api')) {
      return `await Endpoint.create${classData.name}(connection)`;
    }

    return `new ${classData.name}()`;
  }

  /**
   * Infer common workflows
   */
  private inferWorkflows(classData: any): string[] {
    const workflows: string[] = [];

    if (classData.name === 'ThreadApi') {
      workflows.push('create-thread-and-send-message', 'list-messages');
    }

    if (classData.name === 'StoreApi') {
      workflows.push('upload-file', 'download-file');
    }

    return workflows;
  }
}
