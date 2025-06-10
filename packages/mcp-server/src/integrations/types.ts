/**
 * Integration Layer Types
 * Types for integrating proven tools with PrivMX intelligence
 */

import {
  JsonValue,
  ConfigObject,
  UserContext as BaseUserContext,
  SupportedFramework,
  SupportedLanguage,
  BaseResult,
} from '../common/types.js';

export interface TemplateGenerationRequest {
  templateId: string;
  projectName: string;
  framework: SupportedFramework;
  language: SupportedLanguage;
  features: string[];
  privmxConfig: {
    solutionId?: string;
    platformUrl?: string;
    apiEndpoints: string[];
  };
  userContext: BaseUserContext;
}

export interface CodeTransformationRequest {
  sourceCode: string;
  transformation:
    | 'add-privmx-integration'
    | 'upgrade-sdk'
    | 'add-security-patterns';
  targetFramework?: string;
  options?: ConfigObject;
}

export interface WorkflowBuildRequest {
  goal: string;
  userContext: BaseUserContext;
}

export interface PrivMXIntelligenceRequest {
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

export interface IntegrationResult<T = JsonValue> extends BaseResult<T> {
  metadata?: BaseResult<T>['metadata'] & {
    toolUsed: 'plop' | 'jscodeshift' | 'inquirer' | 'privmx-intelligence';
  };
}

// Plop-specific types
export interface PlopConfig {
  generators: Record<string, PlopGenerator>;
}

export interface PlopPrompt {
  type: 'input' | 'list' | 'checkbox' | 'confirm';
  name: string;
  message: string;
  choices?: string[] | { name: string; value: string }[];
  default?: string | number | boolean;
}

export interface PlopAction {
  type: 'add' | 'modify' | 'addMany';
  path: string;
  templateFile?: string;
  template?: string;
  data?: Record<string, unknown>;
}

export interface PlopGenerator {
  description: string;
  prompts: PlopPrompt[];
  actions: PlopAction[];
}

export interface PlopTemplateData {
  projectName: string;
  appName: string;
  framework: string;
  language: string;
  features: string[];
  privmxConfig: {
    solutionId?: string;
    platformUrl?: string;
    apiEndpoints: string[];
  };
  // Framework flags
  isReact?: boolean;
  isVue?: boolean;
  isVanilla?: boolean;
  isNodejs?: boolean;
  // Language flags
  isTypeScript?: boolean;
  isJavaScript?: boolean;
  // Feature flags
  hasMessaging?: boolean;
  hasFileSharing?: boolean;
  hasNotifications?: boolean;
  hasAuth?: boolean;
  // User context
  skillLevel?: string;
  includeTests?: boolean;
  includeComments?: boolean;
}

// jscodeshift-specific types
export interface CodeTransformation {
  name: string;
  description: string;
  transform: (
    source: string,
    api: Record<string, unknown>,
    options: Record<string, unknown>
  ) => string;
}

// Inquirer workflow types
export interface WorkflowStep {
  id: string;
  type: 'input' | 'list' | 'checkbox' | 'confirm';
  message: string;
  choices?: string[] | { name: string; value: string | number | boolean }[];
  when?: (answers: Record<string, unknown>) => boolean;
  validate?: (input: unknown) => boolean | string;
  default?: string | number | boolean;
}

export interface WorkflowSession {
  id: string;
  goal: string;
  steps: WorkflowStep[];
  currentStep: number;
  answers: Record<string, unknown>;
  generatedFiles: string[];
  status: 'active' | 'completed' | 'failed';
}

// PrivMX Intelligence types
export interface APIRelationship {
  api: string;
  dependencies: string[];
  prerequisites: string[];
  commonPatterns: string[];
  securityConsiderations: string[];
}

export interface WorkflowSuggestion {
  title: string;
  description: string;
  steps: Array<{
    action: string;
    apis: string[];
    code?: string;
  }>;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
}

export interface PatternValidation {
  isValid: boolean;
  issues: Array<{
    type: 'security' | 'performance' | 'best-practice';
    message: string;
    severity: 'error' | 'warning' | 'info';
    suggestion?: string;
  }>;
}

export interface OptimizationSuggestion {
  type: 'performance' | 'security' | 'api-usage';
  description: string;
  impact: 'high' | 'medium' | 'low';
  implementation: {
    code?: string;
    instructions: string[];
  };
}
