/**
 * Web-Compatible Template Engine
 * Handles template processing without Handlebars dependency issues in webpack
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  TemplateGenerationRequest,
  IntegrationResult,
  PlopTemplateData,
} from './types.js';

export class WebCompatibleTemplateEngine {
  private templatesPath: string;
  private outputPath: string;

  constructor(
    templatesPath = './src/templates/privmx',
    outputPath = './generated'
  ) {
    this.templatesPath = templatesPath;
    this.outputPath = outputPath;
  }

  /**
   * Simple template variable replacement without Handlebars
   */
  private processTemplate(template: string, data: PlopTemplateData): string {
    let result = template;

    // Simple variable substitution
    result = result.replace(
      /\{\{kebabCase\s+([^}]+)\}\}/g,
      (match, varName) => {
        const value = this.getVariableValue(varName.trim(), data);
        return this.kebabCase(value);
      }
    );

    result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      return this.getVariableValue(varName.trim(), data);
    });

    // Simple conditionals for React
    if (data.isReact) {
      result = result.replace(/\{\{#if\s+isReact\}\}(.*?)\{\{\/if\}\}/gs, '$1');
    } else {
      result = result.replace(/\{\{#if\s+isReact\}\}(.*?)\{\{\/if\}\}/gs, '');
    }

    // Simple conditionals for TypeScript
    if (data.isTypeScript) {
      result = result.replace(
        /\{\{#if\s+isTypeScript\}\}(.*?)\{\{\/if\}\}/gs,
        '$1'
      );
    } else {
      result = result.replace(
        /\{\{#if\s+isTypeScript\}\}(.*?)\{\{\/if\}\}/gs,
        ''
      );
    }

    // Framework variable
    result = result.replace(/\{\{framework\}\}/g, data.framework || 'react');

    return result;
  }

  /**
   * Get variable value from data object
   */
  private getVariableValue(varName: string, data: any): string {
    const keys = varName.split('.');
    let value = data;

    for (const key of keys) {
      value = value?.[key];
    }

    return value?.toString() || '';
  }

  /**
   * Convert string to kebab-case
   */
  private kebabCase(str: string): string {
    return (
      str
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || ''
    );
  }

  /**
   * Generate templates using simplified processing
   */
  async generateTemplates(
    request: TemplateGenerationRequest
  ): Promise<IntegrationResult> {
    try {
      const templateData: PlopTemplateData = {
        projectName: request.projectName,
        appName: request.projectName,
        framework: request.framework,
        language: request.language,
        features: request.features || [],
        privmxConfig: request.privmxConfig,
        includeTests: true, // Default to true
        isTypeScript: request.language === 'typescript',
        isReact: request.framework === 'react',
        isVue: request.framework === 'vue',
        isNodejs: request.framework === 'nodejs',
        hasMessaging: request.features?.includes('messaging') || false,
        hasAuth: request.features?.includes('auth') || false,
        hasFileSharing: request.features?.includes('file-sharing') || false,
        hasNotifications: request.features?.includes('notifications') || false,
        skillLevel: request.userContext.skillLevel,
      };

      // Generate a simple package.json for now
      const packageJson = this.generatePackageJson(templateData);

      const files = [
        {
          path: 'package.json',
          content: packageJson,
        },
        {
          path: 'README.md',
          content: `# ${templateData.appName}\n\nPrivMX ${templateData.framework} application`,
        },
      ];

      return {
        success: true,
        data: { files },
        metadata: {
          toolUsed: 'plop',
          filesGenerated: files.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: { files: [] },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Generate package.json without Handlebars
   */
  private generatePackageJson(data: PlopTemplateData): string {
    const packageObj = {
      name: this.kebabCase(data.appName),
      version: '1.0.0',
      description: 'PrivMX Secure Chat Application',
      main: data.isTypeScript ? 'dist/index.js' : 'src/index.js',
      scripts: {
        ...(data.isReact && {
          dev: 'vite',
          build: data.isTypeScript ? 'tsc && vite build' : 'vite build',
          preview: 'vite preview',
        }),
        ...(data.isNodejs && {
          dev: data.isTypeScript ? 'ts-node src/index.ts' : 'node src/index.js',
          build: data.isTypeScript ? 'tsc' : 'echo "No build needed"',
          start: data.isTypeScript ? 'node dist/index.js' : 'node src/index.js',
        }),
        ...(data.includeTests && {
          test: 'jest',
          'test:watch': 'jest --watch',
        }),
        lint: `eslint src --ext .${data.isTypeScript ? 'ts,tsx' : 'js,jsx'}`,
        format: `prettier --write "src/**/*.{${data.isTypeScript ? 'ts,tsx' : 'js,jsx'},json,css,md}"`,
      },
      dependencies: {
        '@simplito/privmx-webendpoint': '^2.0.0',
        ...(data.isReact && {
          react: '^18.3.0',
          'react-dom': '^18.3.0',
        }),
        ...(data.hasFileSharing &&
          data.isReact && {
            'react-dropzone': '^14.2.0',
          }),
        ...(data.hasNotifications &&
          data.isReact && {
            'react-hot-toast': '^2.4.0',
          }),
        ...(data.isVue && {
          vue: '^3.4.0',
        }),
        ...(data.isNodejs && {
          express: '^4.19.0',
          cors: '^2.8.5',
          helmet: '^7.1.0',
        }),
        ...(data.hasAuth && {
          jsonwebtoken: '^9.0.0',
          bcryptjs: '^2.4.3',
        }),
        uuid: '^10.0.0',
      },
      devDependencies: {
        ...(data.isTypeScript && {
          typescript: '^5.5.0',
          '@types/node': '^20.14.0',
          ...(data.isReact && {
            '@types/react': '^18.3.0',
            '@types/react-dom': '^18.3.0',
          }),
          ...(data.isNodejs && {
            '@types/express': '^4.17.0',
            '@types/cors': '^2.8.0',
          }),
          ...(data.hasAuth && {
            '@types/jsonwebtoken': '^9.0.0',
            '@types/bcryptjs': '^2.4.0',
          }),
          '@types/uuid': '^10.0.0',
          'ts-node': '^10.9.0',
        }),
        ...(data.isReact && {
          '@vitejs/plugin-react': '^4.3.0',
          vite: '^5.3.0',
        }),
        ...(data.isVue && {
          '@vitejs/plugin-vue': '^5.0.0',
          vite: '^5.3.0',
        }),
        eslint: '^8.57.0',
        ...(data.isTypeScript && {
          '@typescript-eslint/eslint-plugin': '^7.13.0',
          '@typescript-eslint/parser': '^7.13.0',
        }),
        ...(data.isReact && {
          'eslint-plugin-react': '^7.34.0',
          'eslint-plugin-react-hooks': '^4.6.0',
        }),
        prettier: '^3.3.0',
        ...(data.includeTests && {
          jest: '^29.7.0',
          ...(data.isTypeScript && {
            '@types/jest': '^29.5.0',
            'ts-jest': '^29.1.0',
          }),
          ...(data.isReact && {
            '@testing-library/react': '^16.0.0',
            '@testing-library/jest-dom': '^6.4.0',
            '@testing-library/user-event': '^14.5.0',
          }),
        }),
        concurrently: '^8.2.0',
      },
      keywords: [
        'privmx',
        'secure-chat',
        'encryption',
        'messaging',
        ...(data.hasFileSharing ? ['file-sharing'] : []),
        data.framework,
      ],
      author: '',
      license: 'MIT',
      private: true,
      ...(data.isReact && {
        type: 'module',
      }),
      engines: {
        node: '>=18.0.0',
      },
    };

    return JSON.stringify(packageObj, null, 2);
  }

  /**
   * List available templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    return ['secure-chat']; // Simple hardcoded list for now
  }

  /**
   * Write files to output directory
   */
  async writeFiles(
    files: Array<{ path: string; content: string }>,
    outputDir: string
  ): Promise<void> {
    const fsExtra = await import('fs-extra');

    // Ensure output directory exists
    await fsExtra.ensureDir(outputDir);

    // Write each file
    for (const file of files) {
      const filePath = path.join(outputDir, file.path);
      await fsExtra.ensureDir(path.dirname(filePath));
      await fsExtra.writeFile(filePath, file.content, 'utf8');
    }
  }

  /**
   * Generate from template (compatibility method)
   */
  async generateFromTemplate(
    templateId: string,
    data: any
  ): Promise<IntegrationResult> {
    return this.generateTemplates({
      templateId,
      projectName: data.projectName || 'app',
      framework: data.framework || 'react',
      language: data.language || 'typescript',
      features: data.features || [],
      privmxConfig: data.privmxConfig || { apiEndpoints: [] },
      userContext: data.userContext || { skillLevel: 'intermediate' },
    });
  }
}
