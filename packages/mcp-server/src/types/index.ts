/**
 * Centralized type exports for the MCP Server package
 *
 * This file re-exports all types from across the package to provide
 * a single import point and reduce dependency complexity.
 */

// Core MCP types (primary)
export type {
  MCPToolResponse,
  MCPServerCapabilities,
  InteractiveSessionAction,
  InteractiveSessionState,
  InteractiveSessionStatus,
  ActiveSession,
  UserResponse,
  PrivMXConfig,
  PrivMXAppRequest,
  PrivMXTemplate,
  PrivMXWorkflowRequest,
  PrivMXIntelligenceQuery,
  CodeTransformationRequest,
  TransformationOption,
} from './mcp-types.js';

// Use MCP types as primary for overlapping types
export type {
  UserContext,
  ValidationResult,
  GeneratedFile,
  CodeGenerationResult,
} from './mcp-types.js';

// Common utility types
export type {
  PrimitiveValue,
  JsonValue,
  JsonObject,
  JsonArray,
  ConfigValue,
  ConfigObject,
  SupportedFramework,
  SupportedLanguage,
  TemplateData,
  BaseResult,
} from '../common/types.js';

// API knowledge types
export type {
  APIParameter,
  APIType,
  APIReturnType,
  APIMethod,
  APIClass,
  APIProperty,
  APINamespace,
  APIConstant,
  APITypeDefinition,
  APIKnowledge,
  WorkflowDefinition,
  WorkflowParameter,
  APICoverage,
} from '../api/types.js';

// Service types (moved from services/types.js to avoid duplication)
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: 'api' | 'guide' | 'example' | 'class' | 'method';
  language?: string;
  namespace?: string;
  score: number;
  metadata: Record<string, unknown>;
  codeExamples?: string[];
  relatedTopics?: string[];
}

export interface CodeGenerationOptions {
  language: string;
  framework?: string;
  features?: string[];
  includeComments?: boolean;
  includeTests?: boolean;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  targetEnvironment?: 'browser' | 'node' | 'mobile';
}

export interface LegacyDocumentationStats {
  total: number;
  byType: Record<string, number>;
}

export interface IndexingResult {
  indexed: number;
  updated: number;
  errors: number;
}

export interface CodeContext {
  language: string;
  framework?: string;
  targetFramework?: string;
  projectName?: string;
  projectType?: 'prototype' | 'production' | 'learning';
  currentCode?: string;
  userSkillLevel?: 'beginner' | 'intermediate' | 'advanced';
  projectGoals?: string[];
  existingDependencies?: string[];
  targetEnvironment?: 'browser' | 'node' | 'mobile';
  codeStyle?: Record<string, unknown>;
}

export interface GeneratedCode {
  code: string;
  imports: string[];
  dependencies: string[];
  explanation: string;
  warnings?: string[];
  nextSteps?: string[];
}

export interface CodeExample {
  language: string;
  framework?: string;
  code: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface EnhancedSearchResult
  extends Omit<SearchResult, 'codeExamples'> {
  relatedApis: string[];
  usagePatterns: string[];
  complexityScore: number;
  prerequisites: string[];
  codeExamples: CodeExample[];
  contextScore?: number;
  completeness?: number;
  relatedMethods?: string[];
  errorPatterns?: string[];
}

export interface SearchContext {
  language?: string;
  framework?: string;
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  userSkillLevel?: 'beginner' | 'intermediate' | 'advanced';
  projectType?: 'prototype' | 'production' | 'learning';
  previousQueries?: string[];
  codeContext?: string;
  userContext?: {
    language?: string;
    targetFramework?: string;
  };
}

export interface NextStepSuggestion {
  action: string;
  reason: string;
  codeExample?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface WorkflowSuggestion {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  apiMethod: string;
  parameters: Record<string, unknown>;
  prerequisites: string[];
  validation?: string;
  errorHandling?: string;
  codeSnippet?: string;
}

// Workflow types
export type {
  WorkflowTemplate,
  WorkflowFeature,
  WorkflowDependency,
  WorkflowFile,
  WorkflowCategory,
  WorkflowRequest,
  WorkflowResponse,
} from '../services/generation/generation-types.js';

// Documentation types
export type {
  DocumentMetadata,
  CodeBlock,
  ProcessedContent,
  ParsedMDXDocument,
  DocumentationSearchFilters,
  DocumentationResult,
  ConceptualResult,
  TutorialResult,
  LearningPath,
  NextStep,
  KnowledgeGap,
  AdaptedContent,
  IndexResult,
  DocumentationStats,
  SearchQuery,
  SearchContext as DocSearchContext,
} from './documentation-types.js';

// Note: Integration types removed - integrations folder was unused

// Note: Loader types removed - loaders folder was unused
