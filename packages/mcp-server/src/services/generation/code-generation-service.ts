/**
 * Code Generation Service
 *
 * Focused service for generating PrivMX code, templates, and complete applications.
 * Extracted from the large APIKnowledgeService for better separation of concerns.
 */

import logger from '../../common/logger.js';
import {
  createCodeGenerator,
  getSupportedLanguages,
  isLanguageSupported,
} from '../code-generators/index.js';
import { messagingTemplates } from './templates/messaging-templates.js';
import { fileSharingTemplates } from './templates/file-sharing-templates.js';
import { feedbackTemplates } from './templates/feedback-templates.js';
import { collaborationTemplates } from './templates/collaboration-templates.js';
import { SmartTemplateEngine } from '../template-engine/smart-template-engine.js';
import { WorkflowGeneratorFactory } from './workflow-generator-factory.js';
import { WorkflowRequest } from './generation-types.js';
import { ReactAdapter } from '../framework-adapters/react-adapter.js';
import {
  GeneratedCode,
  CodeContext,
  WorkflowTemplate,
} from '../../types/index.js';
import { WorkflowResponse as GenerationResult } from './generation-types.js';
import {
  PrivMXAppRequest,
  PrivMXTemplate,
  GeneratedFile,
} from '../../types/mcp-types.js';

export class CodeGenerationService {
  private templates: WorkflowTemplate[];
  private smartTemplateEngine: SmartTemplateEngine;
  private workflowGenerator: WorkflowGeneratorFactory;
  private initialized = false;

  constructor() {
    this.templates = [
      ...messagingTemplates,
      ...fileSharingTemplates,
      ...feedbackTemplates,
      ...collaborationTemplates,
    ];
    this.smartTemplateEngine = new SmartTemplateEngine();
    this.workflowGenerator = new WorkflowGeneratorFactory();

    // Register framework adapters
    this.smartTemplateEngine.registerFrameworkAdapter(
      'react',
      new ReactAdapter()
    );
  }

  /**
   * Initialize the code generation service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('🏗️ Initializing code generation service...');

    // Initialize any required components
    this.initialized = true;

    logger.info('✅ Code generation service ready!');
  }

  /**
   * Generate setup code for a specific language
   */
  generateSetupCode(language: string, features: string[]): string {
    logger.info(
      `⚙️ Generating ${language} setup code for features: ${features.join(', ')}`
    );

    if (!isLanguageSupported(language)) {
      throw new Error(
        `Language '${language}' is not supported. Supported languages: ${getSupportedLanguages().join(', ')}`
      );
    }

    const generator = createCodeGenerator(language);
    return generator.generateSetup(features);
  }

  /**
   * Generate complete workflow application
   */
  async generateWorkflow(
    templateId: string,
    language: string,
    features: string[] = [],
    customizations: Record<string, unknown> = {}
  ): Promise<GenerationResult> {
    this.ensureInitialized();

    logger.info(`🏗️ Generating workflow: ${templateId} for ${language}`);

    const request: WorkflowRequest = {
      template: templateId,
      language,
      features,
      customizations,
    };

    return await this.workflowGenerator.generateWorkflow(request);
  }

  /**
   * Generate complete working code for a use case
   */
  async generateCompleteCode(
    goal: string,
    context: CodeContext
  ): Promise<GeneratedCode> {
    this.ensureInitialized();

    logger.info(`🎯 Generating complete code for goal: "${goal}"`);

    try {
      // Use smart template engine for complex generation
      // Note: generateCode method needs to be implemented in SmartTemplateEngine
      // For now, fallback to basic generation
      throw new Error('Advanced generation not yet implemented');
    } catch (error) {
      logger.error('Failed to generate complete code:', error);

      // Fallback to basic code generation
      return {
        code: this.generateBasicCode(goal, context.language),
        imports: ['@simplito/privmx-webendpoint'],
        dependencies: ['@simplito/privmx-webendpoint'],
        explanation: `Basic ${context.language} implementation for: ${goal}`,
        warnings: [
          'This is a basic implementation. Consider adding error handling and validation.',
        ],
        nextSteps: [
          'Add proper error handling',
          'Implement input validation',
          'Add logging and monitoring',
        ],
      };
    }
  }

  /**
   * Generate code from a specific template
   */
  async generateFromTemplate(
    templateId: string,
    context: CodeContext,
    options?: {
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
      projectType?: 'prototype' | 'production' | 'learning';
      customizations?: Record<string, unknown>;
    }
  ): Promise<GeneratedCode> {
    this.ensureInitialized();

    logger.info(`📝 Generating code from template: ${templateId}`);

    // Use smart template engine for template-based generation
    // Note: generateFromTemplate method needs to be implemented
    throw new Error('Template generation not yet implemented');
  }

  /**
   * Generate a complete project from template
   */
  async generateProjectFromTemplate(
    templateId: string,
    projectName: string,
    context: CodeContext,
    options?: {
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
      projectType?: 'prototype' | 'production' | 'learning';
      includeTests?: boolean;
      includeDocumentation?: boolean;
    }
  ): Promise<{
    files: GeneratedFile[];
    instructions: string[];
    nextSteps: string[];
  }> {
    this.ensureInitialized();

    logger.info(
      `🏗️ Generating project: ${projectName} from template: ${templateId}`
    );

    // Use smart template engine for project generation
    // Note: generateProject method needs to be implemented
    throw new Error('Project generation not yet implemented');
  }

  /**
   * Generate a complete PrivMX application
   */
  async generatePrivMXApp(request: PrivMXAppRequest): Promise<{
    success: boolean;
    data?: { files: GeneratedFile[] };
    errors?: string[];
  }> {
    this.ensureInitialized();

    logger.info(
      `🚀 Generating PrivMX ${request.framework} app: ${request.projectName}`
    );

    try {
      const context: CodeContext = {
        language: request.language,
        framework: request.framework,
        projectName: request.projectName,
        userSkillLevel: request.userContext.skillLevel as
          | 'beginner'
          | 'intermediate'
          | 'advanced',
        projectGoals: request.features,
      };

      const result = await this.generateProjectFromTemplate(
        request.templateId,
        request.projectName,
        context,
        {
          skillLevel: request.userContext.skillLevel as
            | 'beginner'
            | 'intermediate'
            | 'advanced',
          projectType: 'production',
          includeTests: true,
          includeDocumentation: true,
        }
      );

      return {
        success: true,
        data: {
          files: result.files,
        },
      };
    } catch (error) {
      logger.error(`Failed to generate PrivMX app: ${error}`);

      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Analyze and improve existing code
   */
  async analyzeCode(
    code: string,
    language: string,
    errorMessage?: string
  ): Promise<{
    issues: string[];
    suggestions: string[];
    fixes: string[];
    improvedCode?: string;
  }> {
    this.ensureInitialized();

    logger.info(`🔍 Analyzing ${language} code`);

    const issues: string[] = [];
    const suggestions: string[] = [];
    const fixes: string[] = [];

    // Basic code analysis
    if (code.includes('console.log')) {
      issues.push('Contains console.log statements');
      suggestions.push('Replace console.log with proper logging');
      fixes.push('Use logger.info() instead of console.log()');
    }

    if (!code.includes('try') && !code.includes('catch')) {
      issues.push('No error handling found');
      suggestions.push('Add try-catch blocks for error handling');
      fixes.push('Wrap async operations in try-catch blocks');
    }

    if (errorMessage) {
      issues.push(`Runtime error: ${errorMessage}`);
      suggestions.push('Fix the reported runtime error');
    }

    // Generate improved code if issues found
    let improvedCode: string | undefined;
    if (issues.length > 0) {
      improvedCode = this.applyBasicFixes(code, language);
    }

    return {
      issues,
      suggestions,
      fixes,
      improvedCode,
    };
  }

  /**
   * Get available templates
   */
  getWorkflowTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  /**
   * Get templates by category
   */
  getWorkflowTemplatesByCategory(category: string): WorkflowTemplate[] {
    return this.templates.filter((template) => template.category === category);
  }

  /**
   * Get a specific template
   */
  getWorkflowTemplate(templateId: string): WorkflowTemplate | null {
    return (
      this.templates.find((template) => template.id === templateId) || null
    );
  }

  /**
   * Get available PrivMX templates
   */
  async getAvailablePrivMXTemplates(): Promise<PrivMXTemplate[]> {
    // Return predefined templates for now
    return [
      {
        id: 'secure-chat',
        name: 'Secure Chat Application',
        description:
          'Real-time messaging with end-to-end encryption using PrivMX Threads',
        frameworks: ['react', 'vue', 'vanilla'],
        features: ['messaging', 'encryption', 'real-time'],
      },
      {
        id: 'file-sharing',
        name: 'Secure File Sharing',
        description: 'File upload/download with encryption using PrivMX Stores',
        frameworks: ['react', 'vue', 'nodejs'],
        features: ['file-upload', 'encryption', 'storage'],
      },
      {
        id: 'feedback-inbox',
        name: 'Anonymous Feedback System',
        description: 'Anonymous feedback collection using PrivMX Inboxes',
        frameworks: ['react', 'vue', 'vanilla'],
        features: ['anonymous', 'feedback', 'forms'],
      },
    ];
  }

  /**
   * Private helper methods
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'CodeGenerationService not initialized. Call initialize() first.'
      );
    }
  }

  private generateBasicCode(goal: string, language: string): string {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('message') || goalLower.includes('chat')) {
      return this.generateBasicMessagingCode(language);
    } else if (goalLower.includes('file') || goalLower.includes('upload')) {
      return this.generateBasicFileCode(language);
    } else {
      return this.generateBasicSetupCode(language);
    }
  }

  private generateBasicMessagingCode(language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return `
import { Endpoint, Thread } from '@simplito/privmx-webendpoint';

async function createSecureChat() {
  // Initialize PrivMX Endpoint
  const endpoint = new Endpoint();
  await endpoint.connect({
    solutionId: 'your-solution-id',
    platformUrl: 'https://api.privmx.dev',
  });

  // Create a new thread for messaging
  const thread = await Thread.createThread(
    endpoint,
    'secure-chat',
    'A secure chat thread',
    []
  );

  console.log('Secure chat created:', thread.threadId);
  return thread;
}

// Usage
createSecureChat().catch(console.error);
        `.trim();

      default:
        return `// Basic messaging setup for ${language}\n// TODO: Implement PrivMX messaging integration`;
    }
  }

  private generateBasicFileCode(language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return `
import { Endpoint, Store } from '@simplito/privmx-webendpoint';

async function createFileStore() {
  // Initialize PrivMX Endpoint
  const endpoint = new Endpoint();
  await endpoint.connect({
    solutionId: 'your-solution-id',
    platformUrl: 'https://api.privmx.dev',
  });

  // Create a new store for file sharing
  const store = await Store.createStore(
    endpoint,
    'file-sharing',
    'A secure file sharing store',
    []
  );

  console.log('File store created:', store.storeId);
  return store;
}

// Usage
createFileStore().catch(console.error);
        `.trim();

      default:
        return `// Basic file handling setup for ${language}\n// TODO: Implement PrivMX file operations`;
    }
  }

  private generateBasicSetupCode(language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return `
import { Endpoint } from '@simplito/privmx-webendpoint';

async function initializePrivMX() {
  // Initialize PrivMX Endpoint
  const endpoint = new Endpoint();
  
  try {
    await endpoint.connect({
      solutionId: 'your-solution-id',
      platformUrl: 'https://api.privmx.dev',
    });
    
    console.log('PrivMX initialized successfully');
    return endpoint;
  } catch (error) {
    console.error('Failed to initialize PrivMX:', error);
    throw error;
  }
}

// Usage
initializePrivMX().catch(console.error);
        `.trim();

      default:
        return `// Basic PrivMX setup for ${language}\n// TODO: Initialize PrivMX SDK`;
    }
  }

  private applyBasicFixes(code: string, language: string): string {
    let fixedCode = code;

    // Replace console.log with proper logging
    if (language === 'javascript' || language === 'typescript') {
      fixedCode = fixedCode.replace(/console\.log\(/g, 'logger.info(');

      // Add logger import if not present
      if (!fixedCode.includes('import') && fixedCode.includes('logger.info')) {
        fixedCode = `import logger from './logger';\n\n${fixedCode}`;
      }
    }

    // Add basic error handling if missing
    if (!fixedCode.includes('try') && !fixedCode.includes('catch')) {
      fixedCode = `try {\n  ${fixedCode.replace(/\n/g, '\n  ')}\n} catch (error) {\n  logger.error('Operation failed:', error);\n  throw error;\n}`;
    }

    return fixedCode;
  }
}
