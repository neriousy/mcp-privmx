/**
 * Common types used throughout the MCP server
 */

// Basic primitive types
export type PrimitiveValue = string | number | boolean | null | undefined;
export type JsonValue = PrimitiveValue | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

// Configuration and options types
export type ConfigValue = string | number | boolean;
export type ConfigObject = Record<string, ConfigValue>;
export type OptionsObject = Record<string, unknown>;

// User and context types
export interface UserContext {
  skillLevel: 'beginner' | 'intermediate' | 'expert';
  preferences?: ConfigObject;
  projectType?: 'prototype' | 'production' | 'learning';
  preferredFramework?: string;
}

// Framework and language types
export type SupportedFramework = 'react' | 'vue' | 'vanilla' | 'nodejs';
export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'swift'
  | 'cpp'
  | 'csharp';

// Template and generation types
export interface TemplateData {
  projectName: string;
  appName: string;
  framework: SupportedFramework;
  language: SupportedLanguage;
  features: string[];
  [key: string]: JsonValue;
}

// API and method types
export interface APICallOptions {
  timeout?: number;
  retries?: number;
  parameters?: Record<string, JsonValue>;
}

// Error and result types
export interface ErrorInfo {
  code: string;
  message: string;
  details?: JsonObject;
}

export interface ResultMetadata {
  toolUsed?: string;
  executionTime?: number;
  filesGenerated?: number;
  [key: string]: JsonValue;
}

// Workflow and step types
export interface WorkflowContext {
  currentStep: number;
  totalSteps: number;
  answers: Record<string, JsonValue>;
  metadata: ResultMetadata;
}

// File and path types
export interface FileInfo {
  path: string;
  content: string;
  language?: SupportedLanguage;
  template?: boolean;
}

// Search and query types
export interface SearchFilters {
  namespace?: string;
  language?: SupportedLanguage;
  complexity?: 'simple' | 'intermediate' | 'advanced';
  hasExamples?: boolean;
}

// Validation types
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

// Event and callback types
export type EventHandler<T = JsonValue> = (data: T) => void | Promise<void>;
export type AsyncCallback<T = JsonValue, R = void> = (data: T) => Promise<R>;

// Integration result types
export interface BaseResult<T = JsonValue> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
  metadata?: ResultMetadata;
}
