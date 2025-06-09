/**
 * Smart Template Engine - Phase 2
 * Advanced code generation with framework-specific templates and intelligent adaptation
 */

import {
  SmartTemplate,
  TemplateFile,
  GeneratedCode,
  CodeContext,
  ValidationResult,
  OptimizedCode,
  SkillLevel,
  ProjectType,
  UserContext,
  GeneratedFile,
  FrameworkAdapter,
} from '../types.js';

export class SmartTemplateEngine {
  private templates: Map<string, SmartTemplate> = new Map();
  private frameworkAdapters: Map<string, FrameworkAdapter> = new Map();
  private templateCache: Map<string, string> = new Map();

  constructor() {
    this.loadBuiltInTemplates();
  }

  /**
   * Generate code from a template with context awareness
   */
  async generateFromTemplate(
    templateId: string,
    context: CodeContext
  ): Promise<GeneratedCode> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Validate context compatibility
    this.validateContext(template, context);

    // Generate base code from template
    const baseCode = await this.processTemplate(template, context);

    // Apply framework-specific adaptations
    const adaptedCode = await this.adaptForFramework(baseCode, context);

    // Apply skill-level optimizations
    const optimizedCode = this.optimizeForSkillLevel(adaptedCode, context);

    return {
      code: optimizedCode,
      imports: [],
      dependencies: this.extractDependencies(template, context),
      explanation: `Generated from template: ${template.name}`,
      warnings: [],
      nextSteps: [
        `Configure PrivMX credentials`,
        `Test the generated code`,
        `Deploy your application`,
      ],
    };
  }

  /**
   * Generate complete project structure from template
   */
  async generateProject(
    templateId: string,
    context: UserContext
  ): Promise<GeneratedFile[]> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const generatedFiles: GeneratedFile[] = [];

    for (const templateFile of template.files) {
      // Check if file should be generated based on context
      if (this.shouldGenerateFile(templateFile, context)) {
        const processedContent = await this.processFileTemplate(
          templateFile,
          context
        );

        generatedFiles.push({
          path: templateFile.path,
          content: processedContent,
          language: templateFile.language,
          framework: templateFile.framework,
          dependencies: this.extractFileDependencies(templateFile),
          description: `Generated from template: ${template.name}`,
          lastModified: new Date(),
        });
      }
    }

    return generatedFiles;
  }

  /**
   * Optimize code for specific framework
   */
  async optimizeForFramework(
    code: string,
    framework: string,
    context: CodeContext
  ): Promise<OptimizedCode> {
    const adapter = this.frameworkAdapters.get(framework);
    if (!adapter) {
      return {
        code,
        optimizations: [],
        performanceImpact: 'No framework-specific optimizations available',
      };
    }

    const optimizedCode = await adapter.adaptCode(code, context);

    return {
      code: optimizedCode,
      optimizations: [
        {
          type: 'performance',
          description: `Optimized for ${framework} framework`,
          impact: 'medium',
          before: code.substring(0, 100) + '...',
          after: optimizedCode.substring(0, 100) + '...',
        },
      ],
      performanceImpact: `Code optimized for ${framework} best practices`,
    };
  }

  /**
   * Register a new template
   */
  registerTemplate(template: SmartTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Register a framework adapter
   */
  registerFrameworkAdapter(name: string, adapter: FrameworkAdapter): void {
    this.frameworkAdapters.set(name, adapter);
  }

  /**
   * Get available templates by criteria
   */
  getTemplates(criteria?: {
    category?: string;
    framework?: string;
    skillLevel?: SkillLevel;
    projectType?: ProjectType;
  }): SmartTemplate[] {
    let templates = Array.from(this.templates.values());

    if (criteria) {
      if (criteria.category) {
        templates = templates.filter(
          (t) => t.category.id === criteria.category
        );
      }
      if (criteria.framework) {
        templates = templates.filter((t) =>
          t.frameworks.includes(criteria.framework!)
        );
      }
      if (criteria.skillLevel) {
        templates = templates.filter((t) =>
          t.skillLevels.includes(criteria.skillLevel!)
        );
      }
    }

    return templates.sort((a, b) => a.complexity - b.complexity);
  }

  /**
   * Validate template context compatibility
   */
  private validateContext(template: SmartTemplate, context: CodeContext): void {
    if (
      context.targetFramework &&
      !template.frameworks.includes(context.targetFramework)
    ) {
      throw new Error(
        `Template '${template.id}' does not support framework '${context.targetFramework}'. ` +
          `Supported frameworks: ${template.frameworks.join(', ')}`
      );
    }

    if (
      context.userSkillLevel &&
      !template.skillLevels.includes(context.userSkillLevel as SkillLevel)
    ) {
      console.warn(
        `Template '${template.id}' may not be suitable for skill level '${context.userSkillLevel}'`
      );
    }
  }

  /**
   * Process template content with variable substitution
   */
  private async processTemplate(
    template: SmartTemplate,
    context: CodeContext
  ): Promise<string> {
    // This is a simplified template processor
    // In production, you might want to use a more sophisticated template engine
    let content = template.files[0]?.content || '';

    // Replace common template variables
    const replacements = {
      '{{className}}': 'PrivMXApp',
      '{{packageName}}': '@privmx/app',
      '{{description}}': 'PrivMX Application',
      '{{framework}}': context.targetFramework || 'vanilla',
      '{{language}}': context.language || 'javascript',
      '{{timestamp}}': new Date().toISOString(),
      '{{userAgent}}': 'PrivMX MCP Server',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }

    return content;
  }

  /**
   * Apply framework-specific code adaptations
   */
  private async adaptForFramework(
    code: string,
    context: CodeContext
  ): Promise<string> {
    if (!context.targetFramework) {
      return code;
    }

    const adapter = this.frameworkAdapters.get(context.targetFramework);
    if (!adapter) {
      console.warn(
        `No adapter found for framework: ${context.targetFramework}`
      );
      return code;
    }

    return await adapter.adaptCode(code, context);
  }

  /**
   * Optimize code based on user skill level
   */
  private optimizeForSkillLevel(code: string, context: CodeContext): string {
    const skillLevel = context.userSkillLevel || 'intermediate';

    switch (skillLevel) {
      case 'beginner':
        return this.addBeginnerComments(code);
      case 'expert':
        return this.addAdvancedOptimizations(code);
      default:
        return code;
    }
  }

  /**
   * Add explanatory comments for beginners
   */
  private addBeginnerComments(code: string): string {
    // Add helpful comments explaining what each section does
    const lines = code.split('\n');
    const commentedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      commentedLines.push(line);

      // Add explanatory comments for key concepts
      if (line.includes('await')) {
        commentedLines.push(
          '    // ↑ Wait for this operation to complete before continuing'
        );
      }
      if (line.includes('try {')) {
        commentedLines.push('    // ↑ Start error handling block');
      }
      if (line.includes('catch')) {
        commentedLines.push('    // ↑ Handle any errors that occurred');
      }
    }

    return commentedLines.join('\n');
  }

  /**
   * Add advanced optimizations for expert users
   */
  private addAdvancedOptimizations(code: string): string {
    // Add performance optimizations and advanced patterns
    return code
      .replace(
        /const \[(\w+), set\1\] = useState\((.*?)\);/g,
        'const [$1, set$1] = useState(() => $2); // Lazy initial state'
      )
      .replace(
        /useEffect\(\(\) => \{/g,
        'useEffect(() => { // Consider useMemo/useCallback for performance'
      );
  }

  /**
   * Extract dependencies from template and context
   */
  private extractDependencies(
    template: SmartTemplate,
    context: CodeContext
  ): string[] {
    const dependencies = template.dependencies
      .filter(
        (dep) => !dep.framework || dep.framework === context.targetFramework
      )
      .map((dep) => dep.name);

    // Add framework-specific dependencies
    if (context.targetFramework) {
      const adapter = this.frameworkAdapters.get(context.targetFramework);
      if (adapter) {
        const frameworkDeps = adapter.generateImports(dependencies);
        return [frameworkDeps, ...dependencies];
      }
    }

    return dependencies;
  }

  /**
   * Check if a file should be generated based on context
   */
  private shouldGenerateFile(
    templateFile: TemplateFile,
    context: UserContext
  ): boolean {
    // Check framework compatibility
    if (
      templateFile.framework &&
      templateFile.framework !== context.preferredFramework
    ) {
      return false;
    }

    // Check conditional generation rules
    if (templateFile.conditional) {
      return this.evaluateCondition(templateFile.conditional, context);
    }

    return true;
  }

  /**
   * Process individual file template
   */
  private async processFileTemplate(
    templateFile: TemplateFile,
    context: UserContext
  ): Promise<string> {
    let content = templateFile.content;

    // Replace template variables specific to the context
    const replacements = {
      '{{projectName}}': context.preferences?.packageManager || 'privmx-app',
      '{{packageManager}}': context.preferences?.packageManager || 'npm',
      '{{typescript}}': context.preferences?.typescript ? 'true' : 'false',
      '{{skillLevel}}': context.skillLevel,
      '{{framework}}': context.preferredFramework || 'vanilla',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return content;
  }

  /**
   * Extract dependencies from a specific file
   */
  private extractFileDependencies(templateFile: TemplateFile): string[] {
    const dependencies: string[] = [];

    // Extract import statements to determine dependencies
    const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(templateFile.content)) !== null) {
      const dependency = match[1];
      if (!dependency.startsWith('.') && !dependency.startsWith('/')) {
        dependencies.push(dependency);
      }
    }

    return dependencies;
  }

  /**
   * Evaluate conditional generation rules
   */
  private evaluateCondition(condition: string, context: UserContext): boolean {
    // Simple condition evaluation - could be expanded for complex rules
    switch (condition) {
      case 'typescript':
        return context.preferences?.typescript === true;
      case 'testing':
        return !!context.preferences?.testingFramework;
      case 'advanced':
        return context.skillLevel === SkillLevel.EXPERT;
      default:
        return true;
    }
  }

  /**
   * Load built-in templates
   */
  private loadBuiltInTemplates(): void {
    // Templates will be loaded from the template library
    // This is a placeholder for the template loading system
    console.log('Loading built-in templates...');
  }

  /**
   * Get available templates with metadata
   */
  getAvailableTemplates(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    supportedFrameworks: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  }> {
    return Array.from(this.templates.values()).map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category.name,
      supportedFrameworks: template.frameworks,
      complexity: this.mapComplexityToString(template.complexity),
    }));
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): Array<{
    id: string;
    name: string;
    description: string;
    supportedFrameworks: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  }> {
    return Array.from(this.templates.values())
      .filter((template) => template.category.name === category)
      .map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        supportedFrameworks: template.frameworks,
        complexity: this.mapComplexityToString(template.complexity),
      }));
  }

  private mapComplexityToString(
    complexity: number
  ): 'simple' | 'moderate' | 'complex' {
    if (complexity <= 3) return 'simple';
    if (complexity <= 7) return 'moderate';
    return 'complex';
  }

  /**
   * Generate complete project structure from template
   */
  async generateProjectStructure(
    templateId: string,
    projectName: string,
    context: CodeContext,
    skillLevel: SkillLevel,
    projectType: ProjectType,
    options: {
      includeTests: boolean;
      includeDocumentation: boolean;
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
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Generate main files from template
    const generatedCode = await this.generateFromTemplate(templateId, context);

    const files: Array<{
      path: string;
      content: string;
      description: string;
    }> = [];

    // Add main implementation files
    for (const file of template.files) {
      const filePath = file.path.replace('{{projectName}}', projectName);
      const fileContent = await this.generateFileContent(
        file,
        context,
        skillLevel,
        projectType
      );

      files.push({
        path: filePath,
        content: fileContent,
        description: `${file.description || 'Generated file'}`,
      });
    }

    // Add configuration files if using framework adapter
    if (context.framework && this.frameworkAdapters.has(context.framework)) {
      const adapter = this.frameworkAdapters.get(context.framework)!;
      const configFiles = await adapter.generateProjectConfiguration(
        projectName,
        context
      );

      for (const [path, content] of Object.entries(configFiles)) {
        files.push({
          path,
          content,
          description: `Configuration file for ${context.framework}`,
        });
      }
    }

    // Add test files if requested
    if (options.includeTests) {
      files.push({
        path: `src/__tests__/${projectName}.test.${context.language === 'typescript' ? 'ts' : 'js'}`,
        content: this.generateTestFile(projectName, context),
        description: 'Basic test file',
      });
    }

    // Add documentation if requested
    if (options.includeDocumentation) {
      files.push({
        path: 'README.md',
        content: this.generateReadme(projectName, template, context),
        description: 'Project documentation',
      });
    }

    const instructions = [
      `Install dependencies: ${context.framework === 'react' ? 'npm install' : 'npm install'}`,
      'Review the generated code and customize as needed',
      'Run the application to test functionality',
    ];

    const nextSteps = [
      'Customize the generated code for your specific needs',
      'Add additional features and components',
      'Set up deployment configuration',
      'Add more comprehensive tests',
    ];

    return { files, instructions, nextSteps };
  }

  private async generateFileContent(
    file: TemplateFile,
    context: CodeContext,
    skillLevel: SkillLevel,
    projectType: ProjectType
  ): Promise<string> {
    let content = file.content;

    // Apply context substitutions
    content = content.replace(
      /\{\{projectName\}\}/g,
      context.projectName || 'MyProject'
    );
    content = content.replace(/\{\{language\}\}/g, context.language);
    content = content.replace(/\{\{framework\}\}/g, context.framework || '');

    // Apply skill level adaptations
    if (skillLevel === 'beginner') {
      content = this.addBeginnerComments(content);
    } else if (skillLevel === SkillLevel.EXPERT) {
      content = this.addAdvancedOptimizations(content);
    }

    // Apply framework adaptations if available
    if (context.framework && this.frameworkAdapters.has(context.framework)) {
      const adapter = this.frameworkAdapters.get(context.framework)!;
      content = await adapter.adaptCode(content, context);
    }

    return content;
  }

  private generateTestFile(projectName: string, context: CodeContext): string {
    const ext = context.language === 'typescript' ? 'ts' : 'js';
    return `// Basic test file for ${projectName}

${context.language === 'typescript' ? "import { describe, it, expect } from 'vitest';" : "const { describe, it, expect } = require('vitest');"}

describe('${projectName}', () => {
  it('should initialize properly', () => {
    // Add your tests here
    expect(true).toBe(true);
  });
});
`;
  }

  private generateReadme(
    projectName: string,
    template: SmartTemplate,
    context: CodeContext
  ): string {
    return `# ${projectName}

${template.description}

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure your PrivMX connection:
   - Set your Bridge URL
   - Configure Solution ID
   - Set up user credentials

3. Run the application:
   \`\`\`bash
   npm start
   \`\`\`

## Features

- Secure communication with PrivMX
- ${context.framework ? `Built with ${context.framework}` : 'Vanilla JavaScript implementation'}
- Production-ready code structure

## Documentation

For more information about PrivMX APIs, visit: https://docs.privmx.com/

## License

MIT
`;
  }
}
