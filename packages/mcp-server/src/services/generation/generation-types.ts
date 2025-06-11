export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  language: string;
  features: WorkflowFeature[];
  dependencies: WorkflowDependency[];
  files: WorkflowFile[];
}

export interface WorkflowFeature {
  name: string;
  description: string;
  apis: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface WorkflowDependency {
  name: string;
  version?: string;
  type: 'runtime' | 'dev' | 'peer';
  manager: 'npm' | 'maven' | 'gradle' | 'spm' | 'nuget';
}

export interface WorkflowFile {
  path: string;
  content: string;
  type: 'source' | 'config' | 'docs' | 'test';
}

export enum WorkflowCategory {
  MESSAGING = 'messaging',
  FILE_SHARING = 'file-sharing',
  FEEDBACK = 'feedback',
  COLLABORATION = 'collaboration',
  FULL_STACK = 'full-stack',
}

export interface WorkflowRequest {
  template: string;
  language: string;
  features?: string[];
  customizations?: Record<string, any>;
}

export interface WorkflowResponse {
  success: boolean;
  template: WorkflowTemplate;
  generatedFiles: WorkflowFile[];
  instructions: string;
  nextSteps: string[];
  error?: string;
}
