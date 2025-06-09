/**
 * Integration Layer - Using Proven Tools + PrivMX Intelligence
 *
 * This layer integrates battle-tested tools with our unique PrivMX knowledge:
 * - Plop.js: Template generation and file management (969K+ downloads)
 * - jscodeshift: Code transformations (Facebook's tool)
 * - Inquirer: Interactive prompts (2M+ downloads)
 * - Our PrivMX Intelligence: API relationships, security patterns, workflows
 */

export { PlopTemplateEngine } from './plop-template-engine.js';
export { WebCompatibleTemplateEngine } from './web-compatible-template-engine.js';
export { JSCodeshiftTransformer } from './jscodeshift-transformer.js';
export { InquirerWorkflowBuilder } from './inquirer-workflow-builder.js';
export { PrivMXIntelligenceEngine } from './privmx-intelligence-engine.js';

// Re-export types for convenience
export type {
  TemplateGenerationRequest,
  CodeTransformationRequest,
  WorkflowBuildRequest,
  PrivMXIntelligenceRequest,
  IntegrationResult,
} from './types.js';
