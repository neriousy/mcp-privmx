/**
 * Core types for PrivMX API Knowledge System
 * Structured representation of PrivMX APIs for code generation
 */

export interface APIParameter {
  name: string;
  description: string;
  type: APIType;
  optional: boolean;
  defaultValue?: string | number | boolean | null;
}

export interface APIType {
  name: string;
  optional: boolean;
  isArray?: boolean;
  generics?: APIType[];
}

export interface APIReturnType {
  type: APIType;
  description: string;
}

export interface APIMethod {
  name: string;
  description: string;
  snippet: string;
  methodType: 'method' | 'static' | 'constructor';
  parameters: APIParameter[];
  returns: APIReturnType[];
  language: string;
  namespace: string;
  className?: string;

  // Relationship information
  prerequisites: string[]; // Methods that must be called first
  relatedMethods: string[]; // Commonly used together
  usagePatterns: string[]; // Common workflow patterns

  // Code generation hints
  errorHandling?: string[]; // Common error scenarios
  examples: CodeExample[]; // Working code examples
  validation?: string[]; // Parameter validation rules
}

export interface APIClass {
  name: string;
  description: string;
  namespace: string;
  language: string;

  // Methods and properties
  methods: APIMethod[];
  staticMethods: APIMethod[];
  constructors: APIMethod[];
  properties: APIProperty[];

  // Relationships
  dependencies: string[]; // Required classes/services
  usedWith: string[]; // Commonly used with these classes

  // Usage information
  creationPattern: string; // How to instantiate this class
  commonWorkflows: string[]; // Typical usage patterns
}

export interface APIProperty {
  name: string;
  description: string;
  type: APIType;
  readonly: boolean;
  static: boolean;
}

export interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: string;
  complete: boolean; // Is this a complete runnable example?
  dependencies: string[]; // Required imports/setup
  workflow?: string; // Associated workflow ID
}

export interface APINamespace {
  name: string;
  description: string;
  language: string;

  classes: APIClass[];
  functions: APIMethod[]; // Standalone functions
  constants: APIConstant[];
  types: APITypeDefinition[];

  // Documentation
  gettingStarted?: string; // Getting started guide
  commonPatterns: string[]; // Common usage patterns
}

export interface APIConstant {
  name: string;
  description: string;
  type: APIType;
  value: string | number | boolean | null;
}

export interface APITypeDefinition {
  name: string;
  description: string;
  definition: string; // TypeScript/language-specific definition
  language: string;
}

/**
 * Complete API Knowledge Graph
 */
export interface APIKnowledge {
  // Core API structure
  namespaces: Map<string, APINamespace>;
  classes: Map<string, APIClass>;
  methods: Map<string, APIMethod>;

  // Language mappings
  languageSupport: Map<string, string[]>; // language -> supported features

  // Cross-references
  dependencies: Map<string, string[]>; // method/class -> prerequisites
  usagePatterns: Map<string, string[]>; // pattern -> related APIs

  // Code examples
  examples: Map<string, CodeExample[]>; // context -> examples
  workflows: Map<string, WorkflowDefinition>;

  // Metadata
  version: string;
  lastUpdated: Date;
  coverage: APICoverage;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  languages: string[];

  steps: WorkflowStep[];
  prerequisites: string[]; // What must be set up first
  outcomes: string[]; // What this workflow achieves

  // Code generation
  template: string; // Code template
  parameters: WorkflowParameter[];
  validation: string[]; // Validation rules

  // Documentation
  examples: CodeExample[];
  troubleshooting: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  apiMethod: string; // Method to call
  parameters: Record<string, string | number | boolean>; // Parameter mapping
  validation?: string; // Validation logic
  errorHandling?: string; // Error handling approach
  nextSteps: string[]; // Possible next steps
}

export interface WorkflowParameter {
  name: string;
  description: string;
  type: string;
  required: boolean;
  defaultValue?: string | number | boolean | null;
  validation?: string;
}

export interface APICoverage {
  totalMethods: number;
  indexedMethods: number;
  languagesCovered: string[];
  examplesCount: number;
  workflowsCount: number;
}

/**
 * Search and Discovery Types
 */
export interface APISearchQuery {
  functionality?: string; // What the user wants to do
  language?: string; // Preferred language
  namespace?: string; // Specific namespace
  hasExamples?: boolean; // Must have examples
  complexity?: 'simple' | 'intermediate' | 'advanced';
}

export interface APISearchResult {
  method: APIMethod;
  relevanceScore: number;
  matchReason: string;
  relatedAPIs: APIMethod[];
  suggestedWorkflow?: WorkflowDefinition;
}

/**
 * Code Generation Types
 */
export interface CodeGenerationRequest {
  type: 'setup' | 'workflow' | 'method' | 'app';
  language: string;
  parameters: Record<string, string | number | boolean>;
  customization?: Record<string, string | number | boolean>;
}

export interface CodeGenerationResult {
  code: string;
  language: string;
  dependencies: string[]; // Required imports
  setup: string[]; // Setup instructions
  usage: string; // How to use the generated code
  validation: string[]; // How to test/validate
  nextSteps: string[]; // What to do next
}

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  template: string; // Template with placeholders
  parameters: TemplateParameter[];
  examples: CodeExample[];
}

export interface TemplateParameter {
  name: string;
  description: string;
  type: string;
  required: boolean;
  defaultValue?: string | number | boolean | null;
  validation?: string;
}
