/**
 * Shared types and interfaces for the API Knowledge Service
 */

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

export interface APIKnowledgeServiceConfig {
  specPath: string;
  supportedLanguages: string[];
}

export interface DocumentationStats {
  total: number;
  byType: Record<string, number>;
}

export interface IndexingResult {
  indexed: number;
  updated: number;
  errors: number;
}

// New: Context-Aware API Intelligence Types
export interface APIRelationshipGraph {
  prerequisites: Map<string, string[]>; // What must be set up first
  dependencies: Map<string, string[]>; // What imports/setup is needed
  commonPatterns: Map<string, WorkflowStep[]>; // Frequent usage sequences
  errorPatterns: Map<string, ErrorHandler[]>; // Common error scenarios
  usageFrequency: Map<string, number>; // How often APIs are used together
}

export interface CodeContext {
  language: string;
  framework?: string;
  targetFramework?: string;
  projectName?: string;
  projectType?: 'prototype' | 'production' | 'learning';
  currentCode?: string;
  userSkillLevel?: 'beginner' | 'intermediate' | 'expert';
  projectGoals?: string[];
  existingDependencies?: string[];
  targetEnvironment?: 'browser' | 'node' | 'mobile';
  codeStyle?: Record<string, unknown>;
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

export interface ErrorHandler {
  errorType: string;
  description: string;
  solution: string;
  codeExample: string;
}

export interface GeneratedCode {
  code: string;
  imports: string[];
  dependencies: string[];
  explanation: string;
  warnings?: string[];
  nextSteps?: string[];
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

export interface CodeExample {
  language: string;
  framework?: string;
  code: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'expert';
}

export interface SearchContext {
  language?: string;
  framework?: string;
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  userSkillLevel?: 'beginner' | 'intermediate' | 'expert';
  projectType?: 'prototype' | 'production' | 'learning';
  previousQueries?: string[];
  codeContext?: string;
  userContext?: {
    language?: string;
    targetFramework?: string;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface WorkflowSuggestion {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'expert';
  tags: string[];
}

export interface NextStepSuggestion {
  action: string;
  reason: string;
  codeExample?: string;
  priority: 'high' | 'medium' | 'low';
}

// Phase 2: Smart Code Generation Templates & Interactive Workflow Builder

export interface SmartTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  frameworks: string[]; // Supported frameworks (React, Vue, Node.js, etc.)
  skillLevels: SkillLevel[]; // Beginner, intermediate, expert
  dependencies: Dependency[]; // Required packages
  files: TemplateFile[]; // Generated files
  workflow: WorkflowStep[]; // Implementation steps
  tags: string[]; // Searchable tags
  complexity: number; // 1-10 complexity rating
}

export interface TemplateFile {
  path: string; // Relative file path
  content: string; // File content template
  language: string; // Programming language
  framework?: string; // Framework-specific content
  conditional?: string; // Generate only if condition met
  executable?: boolean; // Whether file should be executable
  description?: string; // File description
}

export interface Dependency {
  name: string; // Package name
  version?: string; // Version constraint
  type: 'production' | 'development' | 'peer';
  framework?: string; // Framework-specific dependency
  installCommand?: string; // Custom install command if needed
}

export interface WorkflowSession {
  id: string;
  goal: string;
  template: SmartTemplate;
  steps: WorkflowStep[];
  currentStep: number;
  context: UserContext;
  generatedFiles: GeneratedFile[];
  progress: WorkflowProgress;
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'completed' | 'failed';
}

export interface WorkflowProgress {
  completedSteps: number;
  totalSteps: number;
  estimatedTimeRemaining?: number;
  currentStepProgress?: number; // 0-100 percentage
}

export interface UserContext {
  skillLevel: SkillLevel;
  preferredFramework?: string;
  projectType?: ProjectType;
  existingCode?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  codeStyle?: 'functional' | 'class-based' | 'mixed';
  errorHandling?: 'basic' | 'comprehensive' | 'custom';
  testingFramework?: string;
  uiLibrary?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  typescript?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  framework?: string;
  dependencies?: string[];
  description?: string;
  lastModified: Date;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  EXPERT = 'expert',
}

export enum ProjectType {
  WEB_APP = 'web',
  MOBILE_APP = 'mobile',
  DESKTOP_APP = 'desktop',
  API_SERVICE = 'api',
  CLI_TOOL = 'cli',
  LIBRARY = 'library',
}

export interface FrameworkAdapter {
  name: string;
  supportedLanguages: string[];
  adaptCode(code: string, context: CodeContext): Promise<string>;
  generateImports(dependencies: string[]): string;
  generateConfig(): ConfigFile[];
  generateProjectConfiguration(
    projectName: string,
    context: CodeContext
  ): Promise<Record<string, string>>;
  validateCode(code: string): Promise<ValidationResult>;
  getProjectStructure(): ProjectStructure;
}

export interface ConfigFile {
  filename: string;
  content: string;
  description: string;
}

export interface ProjectStructure {
  directories: string[];
  requiredFiles: string[];
  conventions: CodeConvention[];
}

export interface CodeConvention {
  rule: string;
  description: string;
  example?: string;
}

export interface OptimizedCode {
  code: string;
  optimizations: Optimization[];
  performanceImpact?: string;
  securityImprovements?: string[];
}

export interface Optimization {
  type: 'performance' | 'readability' | 'security' | 'maintainability';
  description: string;
  impact: 'low' | 'medium' | 'high';
  before?: string;
  after?: string;
}

export interface InteractiveStep {
  id: string;
  title: string;
  description: string;
  type: 'generate' | 'configure' | 'validate' | 'user_input' | 'choice';
  required: boolean;
  dependencies?: string[]; // IDs of required previous steps
  estimatedTime?: number; // Minutes
  userInput?: UserInputSpec;
  choices?: Choice[];
  validation?: StepValidation;
}

export interface UserInputSpec {
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'file';
  prompt: string;
  placeholder?: string;
  options?: string[];
  validation?: {
    required?: boolean;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface Choice {
  id: string;
  label: string;
  description?: string;
  consequences?: string[]; // What this choice affects
}

export interface StepValidation {
  rules: ValidationRule[];
  onFailure: 'retry' | 'skip' | 'abort';
  maxRetries?: number;
}

export interface ValidationRule {
  type: 'syntax' | 'logic' | 'security' | 'performance' | 'style';
  description: string;
  severity: 'error' | 'warning' | 'info';
  autoFix?: boolean;
}

export interface ValidationIssue {
  type: 'syntax' | 'logic' | 'security' | 'performance' | 'style';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  code?: string;
  fix?: string; // Suggested fix
}

export interface CodeValidationEngine {
  validateCode(
    code: string,
    language: string,
    framework?: string
  ): Promise<ValidationResult>;
  suggestImprovements(
    code: string,
    context: CodeContext
  ): Promise<CodeImprovement[]>;
  autoFixIssues(code: string, issues: ValidationIssue[]): Promise<string>;
}

export interface CodeImprovement {
  type: 'refactor' | 'optimize' | 'modernize' | 'security' | 'accessibility';
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  suggestedCode?: string;
  explanation?: string;
}

export interface TestGeneration {
  framework: string; // Jest, Mocha, XCTest, etc.
  coverageLevel: 'basic' | 'comprehensive' | 'exhaustive';
  testTypes: TestType[];
  mockingStrategy?: 'full' | 'minimal' | 'none';
}

export interface TestType {
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  files: GeneratedFile[];
  coverage: TestCoverage;
}

export interface TestCoverage {
  lines: number; // Percentage
  functions: number; // Percentage
  branches: number; // Percentage
  statements: number; // Percentage
}

export interface APISearchFilters {
  namespace?: string;
  type?: 'class' | 'method' | 'property' | 'guide' | 'example';
  language?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  features: TemplateFeature[];
  dependencies: TemplateDependency[];
}

export interface TemplateFeature {
  name: string;
  description: string;
  complexity: string;
  apis: string[];
}

export interface TemplateDependency {
  name: string;
  version?: string;
  type: string;
}

export interface GenerationResult {
  success: boolean;
  error?: string;
  template: WorkflowTemplate;
  generatedFiles: GeneratedTemplateFile[];
  instructions: string;
  nextSteps: string[];
}

export interface GeneratedTemplateFile {
  path: string;
  content: string;
  type: string;
}
