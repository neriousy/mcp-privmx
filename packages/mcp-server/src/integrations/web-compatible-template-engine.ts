/**
 * Web-Compatible Template Engine
 * Simple template processing for webpack/browser environments
 */

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
   * Simple template processing without external dependencies
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

    // Handle each loops
    result = result.replace(
      /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g,
      (match, arrayName, template) => {
        const array = (data as unknown as Record<string, unknown>)[arrayName];
        if (!Array.isArray(array)) return '';

        return array
          .map((item) => {
            let itemTemplate = template;
            if (typeof item === 'object' && item !== null) {
              Object.entries(item as Record<string, unknown>).forEach(
                ([prop, val]) => {
                  const propPlaceholder = new RegExp(
                    `{{\\s*${prop}\\s*}}`,
                    'g'
                  );
                  itemTemplate = itemTemplate.replace(
                    propPlaceholder,
                    String(val)
                  );
                }
              );
            } else {
              itemTemplate = itemTemplate.replace(/{{this}}/g, String(item));
            }
            return itemTemplate;
          })
          .join('');
      }
    );

    return result;
  }

  /**
   * Generate application from template (browser-compatible)
   */
  async generateFromTemplate(
    request: TemplateGenerationRequest
  ): Promise<
    IntegrationResult<{ files: { path: string; content: string }[] }>
  > {
    try {
      console.log(
        `🌐 Generating ${request.templateId} application (web-compatible)...`
      );

      // Prepare template data
      const templateData = this.prepareTemplateData(request);

      // Generate basic template files for common PrivMX patterns
      const files = this.generateBuiltInTemplates(request, templateData);

      console.log(
        `✅ Generated ${files.length} files successfully (web-compatible)`
      );

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
            : 'Unknown error in web-compatible template generation',
        ],
        metadata: {
          toolUsed: 'plop',
          executionTime: 0,
        },
      };
    }
  }

  /**
   * Generate built-in templates for PrivMX applications
   */
  private generateBuiltInTemplates(
    request: TemplateGenerationRequest,
    data: PlopTemplateData
  ): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = [];

    // Package.json
    files.push({
      path: 'package.json',
      content: this.processSimpleTemplate(
        `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "PrivMX {{framework}} application",
  "main": "{{#if isNodejs}}index.js{{else}}src/main.{{#if isTypeScript}}ts{{else}}js{{/if}}{{/if}}",
  "scripts": {
    {{#if isReact}}"dev": "vite",
    "build": "vite build",
    "preview": "vite preview"{{/if}}
    {{#if isNodejs}}"start": "node index.js",
    "dev": "nodemon index.js"{{/if}}
  },
  "dependencies": {
    "@privmx/privmx-webendpoint": "^2.0.0"{{#if isReact}},
    "react": "^18.0.0",
    "react-dom": "^18.0.0"{{/if}}
    {{#if hasMessaging}},
    "@privmx/privmx-threads": "^1.0.0"{{/if}}
    {{#if hasFileSharing}},
    "@privmx/privmx-stores": "^1.0.0"{{/if}}
    {{#if hasNotifications}},
    "@privmx/privmx-inboxes": "^1.0.0"{{/if}}
  }{{#if isTypeScript}},
  "devDependencies": {
    "typescript": "^5.0.0"{{#if isReact}},
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0"{{/if}}
  }{{/if}}
}`,
        data
      ),
    });

    // Main application file
    if (request.framework === 'react') {
      files.push({
        path: `src/App.${data.isTypeScript ? 'tsx' : 'jsx'}`,
        content: this.processSimpleTemplate(
          `import React from 'react';
{{#if hasMessaging}}import { usePrivMXThreads } from './hooks/usePrivMXThreads';{{/if}}
{{#if hasFileSharing}}import { usePrivMXStores } from './hooks/usePrivMXStores';{{/if}}

function App() {
  {{#if hasMessaging}}const { threads, sendMessage } = usePrivMXThreads();{{/if}}
  {{#if hasFileSharing}}const { stores, uploadFile } = usePrivMXStores();{{/if}}

  return (
    <div className="App">
      <h1>{{projectName}}</h1>
      <p>PrivMX {{framework}} Application</p>
      
      {{#if hasMessaging}}<div>
        <h2>Secure Messaging</h2>
        {/* Add your messaging UI here */}
      </div>{{/if}}
      
      {{#if hasFileSharing}}<div>
        <h2>File Sharing</h2>
        {/* Add your file sharing UI here */}
      </div>{{/if}}
    </div>
  );
}

export default App;`,
          data
        ),
      });
    }

    // Add README
    files.push({
      path: 'README.md',
      content: this.processSimpleTemplate(
        `# {{projectName}}

A PrivMX {{framework}} application with the following features:
{{#each features}}- {{this}}
{{/each}}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure your PrivMX connection in \`src/config/privmx.js\`

3. Start the development server:
   \`\`\`bash
   {{#if isReact}}npm run dev{{/if}}
   {{#if isNodejs}}npm run dev{{/if}}
   \`\`\`

## PrivMX Configuration

Update your PrivMX configuration with your solution credentials:

\`\`\`javascript
export const privmxConfig = {
  solutionId: '{{privmxConfig.solutionId}}',
  platformUrl: '{{privmxConfig.platformUrl}}',
  // Add your specific configuration here
};
\`\`\`

Generated by PrivMX MCP Server with web-compatible templates.`,
        data
      ),
    });

    return files;
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
      // Framework flags
      isReact: request.framework === 'react',
      isVue: request.framework === 'vue',
      isVanilla: request.framework === 'vanilla',
      isNodejs: request.framework === 'nodejs',
      // Language flags
      isTypeScript: request.language === 'typescript',
      isJavaScript: request.language === 'javascript',
      // Feature flags
      hasMessaging: request.features.includes('messaging'),
      hasFileSharing: request.features.includes('file-sharing'),
      hasNotifications: request.features.includes('notifications'),
      hasAuth: request.features.includes('auth'),
      // User context
      skillLevel: request.userContext.skillLevel,
      includeTests: request.userContext.skillLevel !== 'beginner',
      includeComments: request.userContext.skillLevel === 'beginner',
    };
  }

  /**
   * Get available templates (built-in for web compatibility)
   */
  async getAvailableTemplates(): Promise<
    Array<{ name: string; description: string; path: string }>
  > {
    return [
      {
        name: 'secure-chat',
        description: 'Secure messaging application with PrivMX Threads',
        path: 'built-in',
      },
      {
        name: 'file-sharing',
        description: 'File sharing application with PrivMX Stores',
        path: 'built-in',
      },
      {
        name: 'feedback-inbox',
        description: 'Feedback collection system with PrivMX Inboxes',
        path: 'built-in',
      },
    ];
  }
}
