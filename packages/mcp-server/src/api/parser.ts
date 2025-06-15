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
  CodeExample,
  APIConstant,
  APITypeDefinition,
} from './types.js';
import { generateMethodKey } from './utils.js';

/**
 * Raw JSON API structure (as parsed from spec files)
 */
interface RawField {
  name: string;
  description: string;
  type: {
    name: string;
    optional: boolean;
  };
}

interface RawAPISpec {
  [namespace: string]: Array<{
    title: string;
    content: Array<{
      type: 'class' | 'method' | 'function' | 'constant' | 'type';
      name: string;
      description: string;
      fields?: RawField[];
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
    content: RawAPISpec[string],
    language: string,
    filePath: string
  ): Promise<APINamespace> {
    const classes: APIClass[] = [];
    const functions: APIMethod[] = [];
    const constants: APIConstant[] = [];
    const types: APITypeDefinition[] = [];

    // Handle _meta namespace (skip it as it's metadata, not API content)
    if (name === '_meta') {
      console.log(`   ⏭️  Skipping metadata namespace: ${name}`);
      return {
        name,
        description: 'Metadata information',
        language,
        classes: [],
        functions: [],
        constants: [],
        types: [],
        commonPatterns: [],
      };
    }

    // The content should be an array of sections with title and content
    if (!Array.isArray(content)) {
      console.warn(
        `   ⚠️  Warning: content for namespace ${name} is not an array:`,
        typeof content,
        '- skipping'
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

    let itemsProcessed = 0;
    let typesFound = 0;
    let methodsFound = 0;
    let classesFound = 0;
    let totalClassMethods = 0;

    for (const section of content) {
      if (section.content && Array.isArray(section.content)) {
        console.log(
          `      📋 Processing section: "${section.title}" (${section.content.length} items)`
        );

        for (const item of section.content) {
          itemsProcessed++;

          if (item.type === 'class') {
            classesFound++;
            const apiClass = await this.parseClass(
              item,
              name,
              language,
              filePath
            );
            classes.push(apiClass);

            // Count methods from this class
            totalClassMethods +=
              apiClass.methods.length +
              apiClass.staticMethods.length +
              apiClass.constructors.length;
          } else if (item.type === 'method' || item.type === 'function') {
            methodsFound++;
            const method = await this.parseMethod(
              item,
              name,
              language,
              undefined,
              filePath
            );
            functions.push(method);
          } else if (item.type === 'type') {
            typesFound++;
            const typeDef = this.parseTypeDefinition(item, name, language);
            if (typeDef) types.push(typeDef);
          } else if (item.type === 'constant') {
            const constant = this.parseConstant(item, name, language);
            if (constant) constants.push(constant);
          }
        }
      }
    }

    const totalMethods = methodsFound + totalClassMethods;
    console.log(
      `      ✅ Processed ${itemsProcessed} items: ${classesFound} classes, ${totalMethods} methods (${methodsFound} standalone + ${totalClassMethods} in classes), ${typesFound} types`
    );

    return {
      name,
      description: this.generateNamespaceDescription(name, language),
      language,
      classes,
      functions,
      constants,
      types,
      commonPatterns: this.inferCommonPatterns(classes, functions),
    };
  }

  /**
   * Parse a class definition
   */
  private async parseClass(
    classData: RawAPISpec[string][0]['content'][0],
    namespace: string,
    language: string,
    filePath: string
  ): Promise<APIClass> {
    const methods: APIMethod[] = [];
    const staticMethods: APIMethod[] = [];
    const constructors: APIMethod[] = [];

    if (classData.methods) {
      console.log(
        `        🔧 Parsing ${classData.methods.length} methods for class: ${classData.name}`
      );

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
      properties: (classData.fields || []).map((f) => ({
        name: f.name,
        description: f.description,
        type: this.parseType(f.type),
        readonly: false,
        static: false,
      })),
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
    methodData: RawMethod | RawAPISpec[string][0]['content'][0],
    namespace: string,
    language: string,
    className?: string,
    filePath?: string
  ): Promise<APIMethod> {
    const parameters = this.parseParameters(methodData.params || []);
    const returns = this.parseReturns(methodData.returns || []);

    return {
      name: methodData.name,
      key: generateMethodKey({
        language,
        namespace,
        className,
        methodName: methodData.name,
        parameters: parameters.map((p) => ({
          type: p.type.name,
          optional: p.optional,
        })),
      }),
      description: methodData.description,
      snippet:
        methodData.snippet || this.generateSnippet(methodData, parameters),
      methodType:
        (methodData.methodType as 'method' | 'static' | 'constructor') ||
        'method',
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
      defaultValue: this.extractDefaultValue(param.description),
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
  private generateSnippet(
    methodData: RawMethod | RawAPISpec[string][0]['content'][0],
    parameters: APIParameter[]
  ): string {
    const paramNames = parameters.map((p) => p.name).join(', ');
    return `${methodData.name}(${paramNames})`;
  }

  /**
   * Infer method prerequisites (what must be called first)
   */
  private inferPrerequisites(
    methodData: RawMethod | RawAPISpec[string][0]['content'][0],
    className?: string
  ): string[] {
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
  private inferRelatedMethods(
    methodData: RawMethod | RawAPISpec[string][0]['content'][0]
  ): string[] {
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
  private inferUsagePatterns(
    methodData: RawMethod | RawAPISpec[string][0]['content'][0]
  ): string[] {
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
  private inferErrorHandling(
    methodData: RawMethod | RawAPISpec[string][0]['content'][0]
  ): string[] {
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
    _methodData: RawMethod | RawAPISpec[string][0]['content'][0],
    _language: string,
    _filePath?: string
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
  private inferDependencies(
    classData: RawAPISpec[string][0]['content'][0],
    _language: string
  ): string[] {
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
  private inferUsageRelationships(
    classData: RawAPISpec[string][0]['content'][0]
  ): string[] {
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
  private generateCreationPattern(
    classData: RawAPISpec[string][0]['content'][0],
    _language: string
  ): string {
    if (classData.name.includes('Api')) {
      return `await Endpoint.create${classData.name}(connection)`;
    }

    return `new ${classData.name}()`;
  }

  /**
   * Infer common workflows
   */
  private inferWorkflows(
    classData: RawAPISpec[string][0]['content'][0]
  ): string[] {
    const workflows: string[] = [];

    if (classData.name === 'ThreadApi') {
      workflows.push('create-thread-and-send-message', 'list-messages');
    }

    if (classData.name === 'StoreApi') {
      workflows.push('upload-file', 'download-file');
    }

    return workflows;
  }

  private parseTypeDefinition(
    item: RawAPISpec[string][0]['content'][0],
    namespace: string,
    language: string
  ): APITypeDefinition | null {
    if (!item || item.type !== 'type') return null;

    const def: APITypeDefinition = {
      name: item.name,
      description: item.description || `${item.name} type`,
      definition: item.snippet || `type ${item.name} = any`,
      language,
    };

    return def;
  }

  private parseConstant(
    item: RawAPISpec[string][0]['content'][0],
    namespace: string,
    language: string
  ): APIConstant | null {
    if (!item || item.type !== 'constant') return null;

    const constType: APIType = {
      name: (item as any).valueType?.name || 'unknown',
      optional: false,
    } as APIType;

    const constant: APIConstant = {
      name: item.name,
      description: item.description || `${item.name} constant`,
      type: constType,
      value: (item as any).value ?? null,
    };

    return constant;
  }

  private extractDefaultValue(desc: string): string | number | boolean | null {
    if (!desc) return null;
    const match = desc.match(/default[:=]\s*([\w\d\-_.]+)/i);
    if (match) {
      const val = match[1];
      if (val === 'true' || val === 'false') return val === 'true';
      const num = Number(val);
      return isNaN(num) ? val : num;
    }
    return null;
  }
}
