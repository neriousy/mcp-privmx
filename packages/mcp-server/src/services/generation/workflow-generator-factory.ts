import {
  WorkflowTemplate,
  WorkflowRequest,
  WorkflowResponse,
  WorkflowFile,
} from './generation-types.js';
import { messagingTemplates } from './templates/messaging-templates.js';
import { fileSharingTemplates } from './templates/file-sharing-templates.js';
import { feedbackTemplates } from './templates/feedback-templates.js';
import { collaborationTemplates } from './templates/collaboration-templates.js';
import { BaseCodeGenerator } from '../code-generators/base-generator.js';
import {
  createCodeGenerator,
  getSupportedLanguages,
} from '../code-generators/index.js';

export class WorkflowGeneratorFactory {
  private templates: WorkflowTemplate[];
  private codeGenerators: Map<string, BaseCodeGenerator>;

  constructor() {
    this.templates = [
      ...messagingTemplates,
      ...fileSharingTemplates,
      ...feedbackTemplates,
      ...collaborationTemplates,
    ];

    // Dynamically create generators for all registered languages
    this.codeGenerators = new Map();
    for (const lang of getSupportedLanguages()) {
      try {
        this.codeGenerators.set(lang, createCodeGenerator(lang));
      } catch {
        // ignore unsupported at this stage
      }
    }
  }

  /**
   * Get all available workflow templates
   */
  getAvailableTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return this.templates.filter((template) => template.category === category);
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): WorkflowTemplate | undefined {
    return this.templates.find((template) => template.id === templateId);
  }

  /**
   * Generate a complete workflow application
   */
  async generateWorkflow(request: WorkflowRequest): Promise<WorkflowResponse> {
    try {
      // Find the template
      const template = this.getTemplate(request.template);
      if (!template) {
        return {
          success: false,
          template: {} as WorkflowTemplate,
          generatedFiles: [],
          instructions: '',
          nextSteps: [],
          error: `Template '${request.template}' not found`,
        };
      }

      // Get the code generator for the language
      const generator = this.codeGenerators.get(request.language.toLowerCase());
      if (!generator) {
        return {
          success: false,
          template,
          generatedFiles: [],
          instructions: '',
          nextSteps: [],
          error: `Language '${request.language}' not supported`,
        };
      }

      // Clone template and customize for the requested language
      const customizedTemplate = { ...template, language: request.language };

      // Generate the complete application files
      const generatedFiles = await this.generateApplicationFiles(
        customizedTemplate,
        generator,
        request.features,
        request.customizations
      );

      // Generate setup instructions
      const instructions = this.generateSetupInstructions(customizedTemplate);
      const nextSteps = this.generateNextSteps(customizedTemplate);

      return {
        success: true,
        template: customizedTemplate,
        generatedFiles,
        instructions,
        nextSteps,
      };
    } catch (error) {
      return {
        success: false,
        template: {} as WorkflowTemplate,
        generatedFiles: [],
        instructions: '',
        nextSteps: [],
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate all application files for a workflow
   */
  private async generateApplicationFiles(
    template: WorkflowTemplate,
    generator: BaseCodeGenerator,
    selectedFeatures?: string[],
    customizations?: Record<string, any>
  ): Promise<WorkflowFile[]> {
    const files: WorkflowFile[] = [];

    // Generate main application file
    const mainApp = await this.generateMainApplication(template, generator);
    files.push(mainApp);

    // Generate feature-specific files
    for (const feature of template.features) {
      if (!selectedFeatures || selectedFeatures.includes(feature.name)) {
        const featureFiles = await this.generateFeatureFiles(
          feature,
          template,
          generator
        );
        files.push(...featureFiles);
      }
    }

    // Generate configuration files
    const configFiles = await this.generateConfigurationFiles(template);
    files.push(...configFiles);

    // Generate documentation
    const docFiles = await this.generateDocumentationFiles(template);
    files.push(...docFiles);

    return files;
  }

  /**
   * Generate the main application entry point
   */
  private async generateMainApplication(
    template: WorkflowTemplate,
    generator: BaseCodeGenerator
  ): Promise<WorkflowFile> {
    const appName = template.name.replace(/\s+/g, '');
    const fileName =
      template.language === 'java'
        ? `${appName}.java`
        : template.language === 'swift'
          ? `${appName}.swift`
          : template.language === 'csharp'
            ? `${appName}.cs`
            : `app.${template.language === 'typescript' ? 'ts' : 'js'}`;

    // Generate comprehensive main application code
    const content = `${this.generateFileHeader(template)}

${this.generateImports(template)}

${this.generateMainClass(template, generator)}

${this.generateFeatureIntegration(template)}

${this.generateErrorHandling(template)}

${this.generateExportStatement(template)}`;

    return {
      path: fileName,
      content,
      type: 'source',
    };
  }

  /**
   * Generate feature-specific implementation files
   */
  private async generateFeatureFiles(
    feature: any,
    template: WorkflowTemplate,
    generator: BaseCodeGenerator
  ): Promise<WorkflowFile[]> {
    const files: WorkflowFile[] = [];
    const featureName = feature.name.replace(/\s+/g, '').toLowerCase();

    // Generate feature implementation
    const implContent = await generator.generateFeatureImplementation(
      feature,
      template.language
    );
    files.push({
      path: `features/${featureName}.${this.getFileExtension(template.language)}`,
      content: implContent,
      type: 'source',
    });

    // Generate feature tests
    const testContent = await generator.generateFeatureTests(
      feature,
      template.language
    );
    files.push({
      path: `tests/${featureName}.test.${this.getFileExtension(template.language)}`,
      content: testContent,
      type: 'test',
    });

    return files;
  }

  /**
   * Generate configuration files (package.json, etc.)
   */
  private async generateConfigurationFiles(
    template: WorkflowTemplate
  ): Promise<WorkflowFile[]> {
    const files: WorkflowFile[] = [];

    if (
      template.language === 'javascript' ||
      template.language === 'typescript'
    ) {
      // Generate package.json
      const packageJson = {
        name: template.id,
        version: '1.0.0',
        description: template.description,
        main: template.language === 'typescript' ? 'dist/app.js' : 'app.js',
        scripts: {
          start: 'node app.js',
          dev: 'nodemon app.js',
          build:
            template.language === 'typescript'
              ? 'tsc'
              : 'echo "No build needed"',
          test: 'jest',
        },
        dependencies: Object.fromEntries(
          template.dependencies
            .filter((dep) => dep.type === 'runtime')
            .map((dep) => [dep.name, dep.version || 'latest'])
        ),
        devDependencies: Object.fromEntries(
          template.dependencies
            .filter((dep) => dep.type === 'dev')
            .map((dep) => [dep.name, dep.version || 'latest'])
        ),
      };

      files.push({
        path: 'package.json',
        content: JSON.stringify(packageJson, null, 2),
        type: 'config',
      });

      // Generate TypeScript config if needed
      if (template.language === 'typescript') {
        const tsConfig = {
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist'],
        };

        files.push({
          path: 'tsconfig.json',
          content: JSON.stringify(tsConfig, null, 2),
          type: 'config',
        });
      }
    }

    return files;
  }

  /**
   * Generate documentation files
   */
  private async generateDocumentationFiles(
    template: WorkflowTemplate
  ): Promise<WorkflowFile[]> {
    const readme = `# ${template.name}

${template.description}

## Features

${template.features.map((f) => `- **${f.name}**: ${f.description}`).join('\n')}

## Installation

\`\`\`bash
${this.getInstallCommand(template.language)}
\`\`\`

## Usage

\`\`\`${template.language}
${this.generateUsageExample(template)}
\`\`\`

## API Documentation

${this.generateApiDocs(template)}

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

MIT License - see LICENSE file for details.
`;

    return [
      {
        path: 'README.md',
        content: readme,
        type: 'docs',
      },
    ];
  }

  // Helper methods
  private generateFileHeader(template: WorkflowTemplate): string {
    return `/**
 * ${template.name}
 * ${template.description}
 * 
 * Generated by PrivMX MCP Server - Workflow Generator
 * Language: ${template.language}
 * Template: ${template.id}
 */`;
  }

  private generateImports(template: WorkflowTemplate): string {
    if (
      template.language === 'javascript' ||
      template.language === 'typescript'
    ) {
      return `import { PrivmxClient } from '@simplito/privmx-webendpoint';
import { Utils } from '@simplito/privmx-webendpoint/extra';
import { Types } from '@simplito/privmx-webendpoint';`;
    }
    return '// Imports will be generated based on language specifics';
  }

  private generateMainClass(
    template: WorkflowTemplate,
    generator: BaseCodeGenerator
  ): string {
    return `// Main application class will be generated by the code generator
// This will include all the core functionality for ${template.name}`;
  }

  private generateFeatureIntegration(template: WorkflowTemplate): string {
    return `// Feature integration code
// Connects all features: ${template.features.map((f) => f.name).join(', ')}`;
  }

  private generateErrorHandling(template: WorkflowTemplate): string {
    return `// Comprehensive error handling
// Includes logging, recovery, and user feedback mechanisms`;
  }

  private generateExportStatement(template: WorkflowTemplate): string {
    return template.language === 'javascript' ||
      template.language === 'typescript'
      ? 'export default App;'
      : '// Export handled by language-specific generator';
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      java: 'java',
      swift: 'swift',
      csharp: 'cs',
    };
    return extensions[language] || 'txt';
  }

  private getInstallCommand(language: string): string {
    return language === 'javascript' || language === 'typescript'
      ? 'npm install'
      : language === 'java'
        ? 'mvn install'
        : language === 'swift'
          ? 'swift package resolve'
          : language === 'csharp'
            ? 'dotnet restore'
            : 'echo "Install dependencies for your platform"';
  }

  private generateUsageExample(template: WorkflowTemplate): string {
    return `// Example usage for ${template.name}
// This will be expanded with actual implementation details`;
  }

  private generateApiDocs(template: WorkflowTemplate): string {
    return template.features
      .map(
        (feature) =>
          `### ${feature.name}\n${feature.description}\n\n**APIs Used:** ${feature.apis.join(', ')}`
      )
      .join('\n\n');
  }

  private generateSetupInstructions(template: WorkflowTemplate): string {
    return `## Setup Instructions for ${template.name}

1. **Install Dependencies**
   \`\`\`bash
   ${this.getInstallCommand(template.language)}
   \`\`\`

2. **Configure PrivMX Connection**
   - Set up your PrivMX server credentials
   - Configure API endpoints and keys

3. **Initialize Application**
   - Run the application
   - Configure initial settings

4. **Test Features**
   ${template.features.map((f, i) => `   ${i + 1}. Test ${f.name}`).join('\n')}`;
  }

  private generateNextSteps(template: WorkflowTemplate): string[] {
    return [
      'Customize the generated code for your specific needs',
      'Add additional error handling and validation',
      'Implement user authentication and authorization',
      'Add logging and monitoring capabilities',
      'Deploy to your preferred hosting platform',
      'Set up CI/CD pipeline for automated deployment',
    ];
  }
}
