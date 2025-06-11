/**
 * TemplateManagementService - Handles template operations and generation
 *
 * Consolidates template-related functionality from the monolithic service
 * including template discovery, management, and code generation.
 */

import {
  createCodeGenerator,
  getSupportedLanguages,
  isLanguageSupported,
} from '../code-generators/index.js';
import { messagingTemplates } from '../generation/templates/messaging-templates.js';
import { fileSharingTemplates } from '../generation/templates/file-sharing-templates.js';
import { feedbackTemplates } from '../generation/templates/feedback-templates.js';
import { collaborationTemplates } from '../generation/templates/collaboration-templates.js';
import type {
  WorkflowTemplate,
  CodeContext,
  GeneratedCode,
} from '../../types/index.js';

export class TemplateManagementService {
  private templates: WorkflowTemplate[];
  private initialized = false;

  constructor() {
    this.templates = [
      ...messagingTemplates,
      ...fileSharingTemplates,
      ...feedbackTemplates,
      ...collaborationTemplates,
    ];
  }

  /**
   * Initialize the template management service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('📋 Initializing Template Management Service...');
      this.initialized = true;
      console.log('✅ Template Management Service initialized successfully');
    } catch (error) {
      console.error(
        '❌ Failed to initialize Template Management Service:',
        error
      );
      throw error;
    }
  }

  /**
   * Generate setup code for a specific language and features
   */
  generateSetupCode(language: string, features: string[]): string {
    this.ensureInitialized();

    console.log(
      `⚙️ Generating setup code for ${language} with features: ${features.join(', ')}`
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
   * Get all available workflow templates
   */
  getWorkflowTemplates(): WorkflowTemplate[] {
    this.ensureInitialized();

    console.log('📋 Retrieving all workflow templates...');

    return this.templates;
  }

  /**
   * Get workflow templates by category
   */
  getWorkflowTemplatesByCategory(category: string): WorkflowTemplate[] {
    this.ensureInitialized();

    console.log(`📋 Retrieving workflow templates for category: ${category}`);

    return this.templates.filter((template) => template.category === category);
  }

  /**
   * Get a specific workflow template
   */
  getWorkflowTemplate(templateId: string): WorkflowTemplate | null {
    this.ensureInitialized();

    console.log(`📋 Retrieving workflow template: ${templateId}`);

    return (
      this.templates.find((template) => template.id === templateId) || null
    );
  }

  /**
   * Generate code from a template
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

    console.log(`🏗️ Generating code from template: ${templateId}`);

    const template = this.getWorkflowTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Generate basic code based on template
    const code = this.generateCodeFromTemplate(template, context);

    return {
      code,
      imports: this.generateImports(template, context),
      dependencies: template.dependencies.map((dep) => dep.name),
      explanation: `Generated ${context.language} code for ${template.name}`,
      warnings: [],
      nextSteps: [
        `Review the generated code`,
        `Install dependencies`,
        `Test the implementation`,
      ],
    };
  }

  /**
   * Get templates by category (simplified)
   */
  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    this.ensureInitialized();

    console.log(`🗂️ Retrieving templates for category: ${category}`);

    return this.getWorkflowTemplatesByCategory(category);
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
    files: Array<{
      path: string;
      content: string;
      description: string;
    }>;
    instructions: string[];
    nextSteps: string[];
  }> {
    this.ensureInitialized();

    console.log(
      `🏗️ Generating project from template: ${templateId} (${projectName})`
    );

    try {
      const template = this.getWorkflowTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const generatedCode = await this.generateFromTemplate(
        templateId,
        context,
        options
      );

      // Create project files
      const files = [
        {
          path: `${projectName}/src/main.${this.getFileExtension(context.language)}`,
          content: generatedCode.code,
          description: `Main ${context.language} implementation file`,
        },
        {
          path: `${projectName}/package.json`,
          content: this.generatePackageJson(
            projectName,
            generatedCode.dependencies
          ),
          description: 'Package configuration file',
        },
      ];

      return {
        files,
        instructions: [
          `1. Install dependencies: npm install`,
          `2. Review the generated code in src/main.${this.getFileExtension(context.language)}`,
          `3. Configure your PrivMX credentials`,
          `4. Run the application`,
        ],
        nextSteps: generatedCode.nextSteps || [],
      };
    } catch (error) {
      console.error(
        `❌ Failed to generate project from template ${templateId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Validate template configuration
   */
  async validateTemplate(templateId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    this.ensureInitialized();

    console.log(`✓ Validating template: ${templateId}`);

    const template = this.getWorkflowTemplate(templateId);
    if (!template) {
      return {
        isValid: false,
        errors: [`Template not found: ${templateId}`],
        warnings: [],
      };
    }

    // Basic template validation
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!template.name) errors.push('Template missing name');
    if (!template.description) warnings.push('Template missing description');
    if (!template.language) errors.push('Template missing language');
    if (!template.features || template.features.length === 0) {
      warnings.push('Template has no features defined');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get template dependencies
   */
  getTemplateDependencies(templateId: string): Array<{
    name: string;
    version?: string;
    type: string;
    description?: string;
  }> {
    this.ensureInitialized();

    console.log(`📦 Getting dependencies for template: ${templateId}`);

    const template = this.getWorkflowTemplate(templateId);
    if (!template) {
      console.warn(`Template not found: ${templateId}`);
      return [];
    }

    return template.dependencies.map((dep) => ({
      name: dep.name,
      version: dep.version,
      type: dep.type,
      description: `${dep.type} dependency for ${template.name}`,
    }));
  }

  /**
   * Get service statistics
   */
  getStats() {
    const templates = this.getWorkflowTemplates();

    return {
      initialized: this.initialized,
      totalTemplates: templates.length,
      categoryCounts: this.getCategoryCounts(templates),
      languageSupport: this.getLanguageSupport(templates),
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'TemplateManagementService not initialized. Call initialize() first.'
      );
    }
  }

  private generateCodeFromTemplate(
    template: WorkflowTemplate,
    context: CodeContext
  ): string {
    // Simple template-based code generation
    const { language } = context;

    return `// Generated ${language} code for ${template.name}
// Features: ${template.features.map((f) => f.name).join(', ')}

${this.generateImportStatements(template, language)}

// Main implementation
export class ${template.name.replace(/[^a-zA-Z0-9]/g, '')}App {
  constructor() {
    // Initialize your application
  }

  async start() {
    // Start your application
    console.log('${template.name} application started');
  }
}

// Initialize and start
const app = new ${template.name.replace(/[^a-zA-Z0-9]/g, '')}App();
app.start();
`;
  }

  private generateImports(
    template: WorkflowTemplate,
    context: CodeContext
  ): string[] {
    const imports: string[] = [];

    // Add imports based on template dependencies
    template.dependencies.forEach((dep) => {
      if (
        context.language === 'javascript' ||
        context.language === 'typescript'
      ) {
        imports.push(`import ${dep.name} from '${dep.name}';`);
      }
    });

    return imports;
  }

  private generateImportStatements(
    template: WorkflowTemplate,
    language: string
  ): string {
    const imports = this.generateImports(template, { language });
    return imports.join('\n');
  }

  private generatePackageJson(
    projectName: string,
    dependencies: string[]
  ): string {
    const deps: Record<string, string> = {};
    dependencies.forEach((dep) => {
      deps[dep] = 'latest';
    });

    return JSON.stringify(
      {
        name: projectName,
        version: '1.0.0',
        description: `PrivMX application: ${projectName}`,
        main: 'src/main.js',
        scripts: {
          start: 'node src/main.js',
          dev: 'node --watch src/main.js',
        },
        dependencies: deps,
      },
      null,
      2
    );
  }

  private getFileExtension(language: string): string {
    switch (language.toLowerCase()) {
      case 'typescript':
        return 'ts';
      case 'javascript':
        return 'js';
      case 'python':
        return 'py';
      case 'java':
        return 'java';
      default:
        return 'js';
    }
  }

  private getCategoryCounts(
    templates: WorkflowTemplate[]
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    templates.forEach((template) => {
      counts[template.category] = (counts[template.category] || 0) + 1;
    });
    return counts;
  }

  private getLanguageSupport(
    templates: WorkflowTemplate[]
  ): Record<string, number> {
    const support: Record<string, number> = {};
    templates.forEach((template) => {
      support[template.language] = (support[template.language] || 0) + 1;
    });
    return support;
  }
}
