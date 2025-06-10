/**
 * Integration Layer - Using Proven Tools + PrivMX Intelligence
 *
 * This layer integrates battle-tested tools with our unique PrivMX knowledge:
 * - Plop.js: Template generation and file management (969K+ downloads)
 * - jscodeshift: Code transformations (Facebook's tool)
 * - Inquirer: Interactive prompts (2M+ downloads)
 * - Our PrivMX Intelligence: API relationships, security patterns, workflows
 */

// Template engine exports - PrecompiledTemplateEngine has no webpack issues
export { PrecompiledTemplateEngine } from './precompiled-template-engine.js';
// Note: PlopTemplateEngine and WebCompatibleTemplateEngine commented out to avoid webpack warnings
// export { PlopTemplateEngine } from './plop-template-engine.js';
// export { WebCompatibleTemplateEngine } from './web-compatible-template-engine.js';

// Import for local use
import { PrecompiledTemplateEngine } from './precompiled-template-engine.js';

// Smart template engine selector - now uses PrecompiledTemplateEngine
export const createTemplateEngine = () => {
  // Import and return PrecompiledTemplateEngine directly - available from import above
  return new PrecompiledTemplateEngine();
};
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
