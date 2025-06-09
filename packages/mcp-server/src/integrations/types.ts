/**
 * Integration Layer Types
 * Types for integrating proven tools with PrivMX intelligence
 */

export interface TemplateGenerationRequest {
  templateId: string;
  projectName: string;
  framework: 'react' | 'vue' | 'vanilla' | 'nodejs';
  language: 'javascript' | 'typescript';
  features: string[];
  privmxConfig: {
    solutionId?: string;
    platformUrl?: string;
    apiEndpoints: string[];
  };
  userContext: {
    skillLevel: 'beginner' | 'intermediate' | 'expert';
    preferences?: Record<string, any>;
  };
}

export interface CodeTransformationRequest {
  sourceCode: string;
  transformation:
    | 'add-privmx-integration'
    | 'upgrade-sdk'
    | 'add-security-patterns';
  targetFramework?: string;
  options?: Record<string, any>;
}

export interface WorkflowBuildRequest {
  goal: string;
  userContext: {
    skillLevel: 'beginner' | 'intermediate' | 'expert';
    preferredFramework?: string;
    projectType?: 'prototype' | 'production' | 'learning';
  };
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

export interface IntegrationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    toolUsed: 'plop' | 'jscodeshift' | 'inquirer' | 'privmx-intelligence';
    executionTime?: number;
    filesGenerated?: number;
  };
}

// Plop-specific types
export interface PlopConfig {
  generators: Record<string, PlopGenerator>;
}

export interface PlopGenerator {
  description: string;
  prompts: any[];
  actions: any[];
}

export interface PlopTemplateData {
  projectName: string;
  appName: string;
  framework: string;
  language: string;
  features: string[];
  privmxConfig: any;
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
  transform: (source: string, api: any, options: any) => string;
}

// Inquirer workflow types
export interface WorkflowStep {
  id: string;
  type: 'input' | 'list' | 'checkbox' | 'confirm';
  message: string;
  choices?: string[] | { name: string; value: any }[];
  when?: (answers: any) => boolean;
  validate?: (input: any) => boolean | string;
  default?: string | number | boolean;
}

export interface WorkflowSession {
  id: string;
  goal: string;
  steps: WorkflowStep[];
  currentStep: number;
  answers: Record<string, any>;
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
