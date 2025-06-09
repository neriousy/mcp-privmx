/**
 * Plop.js Template Engine Integration
 * Uses Plop.js for proven template processing with PrivMX intelligence
 */

import { promises as fs } from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import {
  TemplateGenerationRequest,
  IntegrationResult,
  PlopTemplateData,
} from './types.js';

export class PlopTemplateEngine {
  private templatesPath: string;
  private outputPath: string;

  constructor(
    templatesPath = './src/templates/privmx',
    outputPath = './generated'
  ) {
    this.templatesPath = templatesPath;
    this.outputPath = outputPath;
    this.registerHandlebarsHelpers();
  }

  /**
   * Register custom Handlebars helpers for PrivMX templates
   */
  private registerHandlebarsHelpers(): void {
    // String helpers
    Handlebars.registerHelper('kebabCase', (str: string) => {
      return str
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    });

    Handlebars.registerHelper('camelCase', (str: string) => {
      return str?.replace(/[-_\s]+(.)?/g, (_, char) =>
        char ? char.toUpperCase() : ''
      );
    });

    Handlebars.registerHelper('pascalCase', (str: string) => {
      const camelCase = str?.replace(/[-_\s]+(.)?/g, (_, char) =>
        char ? char.toUpperCase() : ''
      );
      return camelCase
        ? camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
        : '';
    });

    // Alias for pascalCase
    Handlebars.registerHelper('properCase', (str: string) => {
      const camelCase = str?.replace(/[-_\s]+(.)?/g, (_, char) =>
        char ? char.toUpperCase() : ''
      );
      return camelCase
        ? camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
        : '';
    });

    // Comparison helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);

    // Array helpers
    Handlebars.registerHelper('contains', (array: any[], item: any) => {
      return Array.isArray(array) && array.includes(item);
    });

    Handlebars.registerHelper('join', (array: any[], separator = ', ') => {
      return Array.isArray(array) ? array.join(separator) : '';
    });

    // Conditional helpers
    Handlebars.registerHelper(
      'if_eq',
      function (this: any, a: any, b: any, options: any) {
        return a === b ? options.fn(this) : options.inverse(this);
      }
    );

    Handlebars.registerHelper(
      'if_contains',
      function (this: any, array: any[], item: any, options: any) {
        return Array.isArray(array) && array.includes(item)
          ? options.fn(this)
          : options.inverse(this);
      }
    );

    // PrivMX-specific helpers
    Handlebars.registerHelper(
      'privmxDeps',
      (framework: string, features: string[], language: string) => {
        const deps: Record<string, string> = {
          '@privmx/privmx-webendpoint': '^2.0.0',
        };

        if (framework === 'react') {
          deps['react'] = '^18.0.0';
          deps['react-dom'] = '^18.0.0';
          if (language === 'typescript') {
            deps['@types/react'] = '^18.0.0';
            deps['@types/react-dom'] = '^18.0.0';
          }
        }

        if (features.includes('notifications')) {
          deps['@privmx/privmx-notifications'] = '^1.0.0';
        }

        if (features.includes('file-sharing')) {
          deps['@privmx/privmx-store'] = '^1.0.0';
        }

        return Object.entries(deps)
          .map(([name, version]) => `    "${name}": "${version}"`)
          .join(',\n');
      }
    );

    Handlebars.registerHelper('privmxImports', (features: string[]) => {
      const imports = ['WebEndpoint'];

      if (features.includes('messaging')) imports.push('ThreadApi');
      if (features.includes('file-sharing')) imports.push('StoreApi');
      if (features.includes('notifications')) imports.push('InboxApi');

      return imports.join(', ');
    });

    // File extension helper
    Handlebars.registerHelper('fileExtensions', (language: string) => {
      return language === 'typescript' ? 'ts,tsx' : 'js,jsx';
    });
  }

  /**
   * Generate application from template
   */
  async generateFromTemplate(
    request: TemplateGenerationRequest
  ): Promise<
    IntegrationResult<{ files: { path: string; content: string }[] }>
  > {
    try {
      console.log(`🏗️  Generating ${request.templateId} application...`);

      // Check if template exists
      const templateDir = path.join(this.templatesPath, request.templateId);
      const templateExists = await this.directoryExists(templateDir);

      if (!templateExists) {
        return {
          success: false,
          errors: [
            `Template '${request.templateId}' not found at ${templateDir}`,
          ],
          metadata: {
            toolUsed: 'plop',
            executionTime: 0,
          },
        };
      }

      // Prepare template data
      const templateData = this.prepareTemplateData(request);

      // Process all template files
      const files = await this.processTemplateDirectory(
        templateDir,
        templateData,
        request
      );

      console.log(`✅ Generated ${files.length} files successfully`);

      return {
        success: true,
        data: { files },
        metadata: {
          toolUsed: 'plop',
          executionTime: Date.now(),
          filesGenerated: files.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'Unknown error during template generation',
        ],
        metadata: {
          toolUsed: 'plop',
          executionTime: 0,
        },
      };
    }
  }

  /**
   * Process entire template directory recursively
   */
  private async processTemplateDirectory(
    templateDir: string,
    templateData: PlopTemplateData,
    request: TemplateGenerationRequest,
    relativePath = ''
  ): Promise<{ path: string; content: string }[]> {
    const files: { path: string; content: string }[] = [];
    const entries = await fs.readdir(templateDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(templateDir, entry.name);
      const currentPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subFiles = await this.processTemplateDirectory(
          fullPath,
          templateData,
          request,
          currentPath
        );
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Process template files
        const processedFile = await this.processTemplateFile(
          fullPath,
          currentPath,
          templateData,
          request
        );
        if (processedFile) {
          files.push(processedFile);
        }
      }
    }

    return files;
  }

  /**
   * Process individual template file
   */
  private async processTemplateFile(
    filePath: string,
    relativePath: string,
    templateData: PlopTemplateData,
    request: TemplateGenerationRequest
  ): Promise<{ path: string; content: string } | null> {
    try {
      // Skip non-template files
      if (path.basename(filePath) === 'index.ts') {
        // This is the Plop config file, not a template
        return null;
      }

      // Read template content
      const templateContent = await fs.readFile(filePath, 'utf8');

      // Process filename (remove .hbs extension and apply templating)
      let outputPath = relativePath;
      if (outputPath.endsWith('.hbs')) {
        outputPath = outputPath.slice(0, -4); // Remove .hbs extension
      }

      // Apply templating to filename if needed
      if (outputPath.includes('{{')) {
        const filenameTemplate = Handlebars.compile(outputPath);
        outputPath = filenameTemplate(templateData);
      }

      // Process template content
      let processedContent: string;
      if (filePath.endsWith('.hbs')) {
        // Process Handlebars template
        const template = Handlebars.compile(templateContent);
        processedContent = template(templateData);
      } else {
        // Plain file, just copy
        processedContent = templateContent;
      }

      return {
        path: outputPath,
        content: processedContent,
      };
    } catch (error) {
      console.warn(
        `⚠️  Could not process template file ${relativePath}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * Prepare template data from request
   */
  private prepareTemplateData(
    request: TemplateGenerationRequest
  ): PlopTemplateData {
    return {
      projectName: request.projectName,
      appName: request.projectName,
      framework: request.framework,
      language: request.language,
      features: request.features,
      privmxConfig: {
        solutionId: request.privmxConfig.solutionId || 'your-solution-id',
        platformUrl: request.privmxConfig.platformUrl || 'https://privmx.cloud',
        apiEndpoints: request.privmxConfig.apiEndpoints,
        // Add computed properties
        hasThreads: request.privmxConfig.apiEndpoints.includes('threads'),
        hasStores: request.privmxConfig.apiEndpoints.includes('stores'),
        hasInboxes: request.privmxConfig.apiEndpoints.includes('inboxes'),
      },
      // Additional computed properties
      isReact: request.framework === 'react',
      isVue: request.framework === 'vue',
      isVanilla: request.framework === 'vanilla',
      isNodejs: request.framework === 'nodejs',
      isTypeScript: request.language === 'typescript',
      isJavaScript: request.language === 'javascript',
      // Feature flags
      hasMessaging: request.features.includes('messaging'),
      hasFileSharing: request.features.includes('file-sharing'),
      hasNotifications: request.features.includes('notifications'),
      hasAuth: request.features.includes('auth'),
      // User context
      skillLevel: request.userContext.skillLevel,
      includeTests: request.userContext.preferences?.includeTests ?? true,
      includeComments: request.userContext.preferences?.includeComments ?? true,
    };
  }

  /**
   * Get available templates
   */
  async getAvailableTemplates(): Promise<
    Array<{ name: string; description: string; path: string }>
  > {
    try {
      const templates: Array<{
        name: string;
        description: string;
        path: string;
      }> = [];
      const entries = await fs.readdir(this.templatesPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const templatePath = path.join(this.templatesPath, entry.name);
          const configPath = path.join(templatePath, 'index.ts');

          if (await this.fileExists(configPath)) {
            templates.push({
              name: entry.name,
              description: `PrivMX ${entry.name.replace('-', ' ')} application template`,
              path: templatePath,
            });
          }
        }
      }

      return templates;
    } catch (error) {
      console.warn('Could not get available templates:', error);
      return [];
    }
  }

  /**
   * Write generated files to output directory
   */
  async writeFiles(
    files: { path: string; content: string }[],
    outputDir?: string
  ): Promise<void> {
    const baseDir = outputDir || this.outputPath;

    for (const file of files) {
      const fullPath = path.join(baseDir, file.path);
      const dir = path.dirname(fullPath);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, file.content, 'utf8');
      console.log(`📄 Created: ${file.path}`);
    }
  }

  /**
   * Utility functions
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
