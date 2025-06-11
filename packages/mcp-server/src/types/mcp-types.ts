/**
 * MCP Server Type Definitions
 *
 * This file contains well-defined TypeScript interfaces to replace
 * generic 'unknown' types throughout the codebase.
 */

/**
 * MCP Tool Response Structure
 */
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
    [key: string]: string | number | boolean;
  }>;
}

/**
 * MCP Server Capabilities
 */
export interface MCPServerCapabilities {
  tools: Record<string, { description: string }>;
  [key: string]: unknown;
}

/**
 * Interactive Session Types
 */
export interface InteractiveSessionAction {
  type: 'template_selection' | 'code_generation' | 'validation' | 'completion';
  description: string;
  options?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  result?: {
    code?: string;
    files?: GeneratedFile[];
    message?: string;
  };
}

export interface InteractiveSessionState {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  nextAction: InteractiveSessionAction;
  isComplete?: boolean;
}

export interface InteractiveSessionStatus {
  currentStep: number;
  totalSteps: number;
  progress: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  generatedFiles: Array<{
    path: string;
    description: string;
    status: 'pending' | 'generated' | 'validated';
  }>;
}

export interface ActiveSession {
  sessionId: string;
  goal: string;
  startedAt: Date;
  currentStep: number;
  totalSteps: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}

/**
 * User Context and Input Types
 */
export interface UserContext {
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredLanguage?: string;
  frameworks?: string[];
  projectType?: 'prototype' | 'production' | 'learning';
  preferences?: Record<string, string | number | boolean>;
}

export interface UserResponse {
  templateId?: string;
  features?: string[];
  customizations?: Record<string, string | number | boolean>;
  confirmation?: boolean;
  feedback?: string;
}

/**
 * Code Generation Types
 */
export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export interface CodeGenerationResult {
  code: string;
  files: GeneratedFile[];
  instructions: string[];
  validationResults?: ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

/**
 * PrivMX-specific Types
 */
export interface PrivMXConfig {
  solutionId?: string;
  platformUrl?: string;
  apiEndpoints: string[];
}

export interface PrivMXAppRequest {
  templateId: string;
  projectName: string;
  framework: 'react' | 'vue' | 'vanilla' | 'nodejs';
  language: 'javascript' | 'typescript';
  features: string[];
  privmxConfig: PrivMXConfig;
  userContext: UserContext;
}

export interface PrivMXTemplate {
  id: string;
  name: string;
  description: string;
  frameworks: string[];
  features: string[];
}

export interface PrivMXWorkflowRequest {
  goal: string;
  userContext: UserContext;
}

export interface PrivMXIntelligenceQuery {
  query: string;
  type:
    | 'api-relationship'
    | 'workflow-suggestion'
    | 'pattern-validation'
    | 'optimization';
  context?: {
    apis?: string[];
    framework?: string;
    codeSnippet?: string;
  };
}

/**
 * Transformation Types
 */
export interface CodeTransformationRequest {
  sourceCode: string;
  transformation:
    | 'add-privmx-integration'
    | 'upgrade-sdk'
    | 'add-security-patterns';
  targetFramework?: string;
  options?: Record<string, string | number | boolean>;
}

export interface TransformationOption {
  id: string;
  name: string;
  description: string;
  frameworks: string[];
}

/**
 * Logger Types
 */
export interface LoggerData {
  [key: string]: string | number | boolean | object | Error;
}

/**
 * Validation Function Types
 */
export type ValidationFunction = (input: string) => boolean | string;

/**
 * Template Helper Types
 */
export type TemplateHelper = (
  ...args: (string | number | boolean)[]
) => string | boolean;

export interface TemplateHelperContext {
  fn: (context: Record<string, unknown>) => string;
  inverse: (context: Record<string, unknown>) => string;
}

/**
 * Handlebars-specific Types
 */
export interface HandlebarsArray {
  [index: number]: unknown;
  length: number;
  join(separator?: string): string;
}

export interface HandlebarsOptions {
  fn: (context: Record<string, unknown>) => string;
  inverse: (context: Record<string, unknown>) => string;
}
