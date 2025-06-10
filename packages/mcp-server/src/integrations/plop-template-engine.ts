/**
 * Plop.js Template Engine Integration
 * Uses Plop.js for proven template processing with PrivMX intelligence
 */

import { promises as fs } from 'fs';
import path from 'path';
// Import handlebars dynamically to avoid webpack issues
// import Handlebars from 'handlebars';
import {
  TemplateGenerationRequest,
  IntegrationResult,
  PlopTemplateData,
} from './types.js';

export class PlopTemplateEngine {
  private templatesPath: string;
  private outputPath: string;
  private handlebars: unknown = null;

  constructor(
    templatesPath = './src/templates/privmx',
    outputPath = './generated'
  ) {
    this.templatesPath = templatesPath;
    this.outputPath = outputPath;
  }

  /**
   * Dynamically load Handlebars only when needed (server-side only)
   */
  private async loadHandlebars(): Promise<unknown> {
    if (this.handlebars) return this.handlebars;

    try {
      // Only load in true Node.js environment (not webpack bundled)
      const isNodeEnv =
        typeof window === 'undefined' &&
        typeof process !== 'undefined' &&
        process.versions &&
        process.versions.node;

      if (isNodeEnv) {
        const { default: Handlebars } = await import('handlebars');
        this.handlebars = Handlebars;
        this.registerHandlebarsHelpers();
        return this.handlebars;
      } else {
        // Browser environment or webpack build - use simple processing
        console.log(
          '🔄 Using simple template processing (webpack/browser environment)'
        );
        return null;
      }
    } catch {
      console.warn(
        '⚠️  Handlebars not available, using simple template replacement'
      );
      return null;
    }
  }

  /**
   * Register custom Handlebars helpers for PrivMX templates
   */
  private registerHandlebarsHelpers(): void {
    if (!this.handlebars) return;

    const Handlebars = this.handlebars as {
      registerHelper: (
        name: string,
        helper: (...args: unknown[]) => unknown
      ) => void;
    };

    // String helpers
    Handlebars.registerHelper('kebabCase', (str: unknown) => {
      const strValue = String(str || '');
      return strValue
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    });

    Handlebars.registerHelper('camelCase', (str: unknown) => {
      const strValue = String(str || '');
      return strValue.replace(/[-_\s]+(.)?/g, (_, char) =>
        char ? char.toUpperCase() : ''
      );
    });

    Handlebars.registerHelper('pascalCase', (str: unknown) => {
      const strValue = String(str || '');
      const camelCase = strValue.replace(/[-_\s]+(.)?/g, (_, char) =>
        char ? char.toUpperCase() : ''
      );
      return camelCase
        ? camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
        : '';
    });

    // Alias for pascalCase
    Handlebars.registerHelper('properCase', (str: unknown) => {
      const strValue = String(str || '');
      const camelCase = strValue.replace(/[-_\s]+(.)?/g, (_, char) =>
        char ? char.toUpperCase() : ''
      );
      return camelCase
        ? camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
        : '';
    });

    // Comparison helpers
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    Handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
    Handlebars.registerHelper(
      'gt',
      (a: unknown, b: unknown) => Number(a) > Number(b)
    );
    Handlebars.registerHelper(
      'gte',
      (a: unknown, b: unknown) => Number(a) >= Number(b)
    );
    Handlebars.registerHelper(
      'lt',
      (a: unknown, b: unknown) => Number(a) < Number(b)
    );
    Handlebars.registerHelper(
      'lte',
      (a: unknown, b: unknown) => Number(a) <= Number(b)
    );

    // Array helpers
    Handlebars.registerHelper('contains', (array: unknown, item: unknown) => {
      return Array.isArray(array) && array.includes(item);
    });

    Handlebars.registerHelper(
      'join',
      (array: unknown, separator: unknown = ', ') => {
        return Array.isArray(array) ? array.join(String(separator)) : '';
      }
    );

    // Conditional helpers
    Handlebars.registerHelper(
      'if_eq',
      function (this: unknown, a: unknown, b: unknown, options: unknown) {
        const opts = options as {
          fn: (context: unknown) => string;
          inverse: (context: unknown) => string;
        };
        return a === b ? opts.fn(this) : opts.inverse(this);
      }
    );

    Handlebars.registerHelper(
      'if_contains',
      function (
        this: unknown,
        array: unknown,
        item: unknown,
        options: unknown
      ) {
        const opts = options as {
          fn: (context: unknown) => string;
          inverse: (context: unknown) => string;
        };
        return Array.isArray(array) && array.includes(item)
          ? opts.fn(this)
          : opts.inverse(this);
      }
    );

    // PrivMX-specific helpers
    Handlebars.registerHelper(
      'privmxDeps',
      (framework: unknown, features: unknown, language: unknown) => {
        const frameworkStr = String(framework);
        const featuresArray = Array.isArray(features) ? features : [];
        const languageStr = String(language);

        const deps: Record<string, string> = {
          '@privmx/privmx-webendpoint': '^2.0.0',
        };

        if (frameworkStr === 'react') {
          deps['react'] = '^18.0.0';
          deps['react-dom'] = '^18.0.0';
          if (languageStr === 'typescript') {
            deps['@types/react'] = '^18.0.0';
            deps['@types/react-dom'] = '^18.0.0';
          }
        }

        if (featuresArray.includes('notifications')) {
          deps['@privmx/privmx-notifications'] = '^1.0.0';
        }

        if (featuresArray.includes('file-sharing')) {
          deps['@privmx/privmx-store'] = '^1.0.0';
        }

        return Object.entries(deps)
          .map(([name, version]) => `    "${name}": "${version}"`)
          .join(',\n');
      }
    );

    Handlebars.registerHelper('privmxImports', (features: unknown) => {
      const featuresArray = Array.isArray(features) ? features : [];
      const imports = ['WebEndpoint'];

      if (featuresArray.includes('messaging')) imports.push('ThreadApi');
      if (featuresArray.includes('file-sharing')) imports.push('StoreApi');
      if (featuresArray.includes('notifications')) imports.push('InboxApi');

      return imports.join(', ');
    });

    // File extension helper
    Handlebars.registerHelper('fileExtensions', (language: unknown) => {
      return String(language) === 'typescript' ? 'ts,tsx' : 'js,jsx';
    });
  }

  /**
   * Fallback simple template processing when Handlebars is not available
   */
  private processSimpleTemplate(
    content: string,
    data: PlopTemplateData
  ): string {
    let result = content;

    // Simple variable replacement
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(placeholder, String(value));
    });

    // Handle simple conditionals
    result = result.replace(
      /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
      (match, condition, content) => {
        return (data as unknown as Record<string, unknown>)[condition]
          ? content
          : '';
      }
    );

    return result;
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

      // Try to load Handlebars, fall back to simple processing if not available
      await this.loadHandlebars();

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
            : 'Unknown error in template generation',
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
          templateData
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
    templateData: PlopTemplateData
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
        if (this.handlebars) {
          const hb = this.handlebars as {
            compile: (
              template: string
            ) => (data: Record<string, unknown>) => string;
          };
          const filenameTemplate = hb.compile(outputPath);
          outputPath = filenameTemplate(
            templateData as unknown as Record<string, unknown>
          );
        } else {
          outputPath = this.processSimpleTemplate(outputPath, templateData);
        }
      }

      // Process template content
      let processedContent: string;
      if (filePath.endsWith('.hbs')) {
        // Process template (Handlebars or simple)
        if (this.handlebars) {
          const hb = this.handlebars as {
            compile: (
              template: string
            ) => (data: Record<string, unknown>) => string;
          };
          const template = hb.compile(templateContent);
          processedContent = template(
            templateData as unknown as Record<string, unknown>
          );
        } else {
          processedContent = this.processSimpleTemplate(
            templateContent,
            templateData
          );
        }
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
      includeTests: Boolean(
        request.userContext.preferences?.includeTests ?? true
      ),
      includeComments: Boolean(
        request.userContext.preferences?.includeComments ?? true
      ),
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
