import {
  createCodeGenerator,
  getSupportedLanguages,
  isLanguageSupported,
} from './code-generators/index.js';
import { messagingTemplates } from './feature-generators/templates/messaging-templates.js';
import { fileSharingTemplates } from './feature-generators/templates/file-sharing-templates.js';
import { feedbackTemplates } from './feature-generators/templates/feedback-templates.js';
import { collaborationTemplates } from './feature-generators/templates/collaboration-templates.js';
import { WorkflowTemplate } from './feature-generators/workflow-types.js';

export class TemplateService {
  private templates: WorkflowTemplate[];

  constructor() {
    this.templates = [
      ...messagingTemplates,
      ...fileSharingTemplates,
      ...feedbackTemplates,
      ...collaborationTemplates,
    ];
  }

  public generateSetupCode(language: string, features: string[]): string {
    if (!isLanguageSupported(language)) {
      throw new Error(
        `Language '${language}' is not supported. Supported languages: ${getSupportedLanguages().join(', ')}`
      );
    }

    const generator = createCodeGenerator(language);
    return generator.generateSetup(features);
  }

  public getWorkflowTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  public getWorkflowTemplatesByCategory(category: string): WorkflowTemplate[] {
    return this.templates.filter((template) => template.category === category);
  }

  public getWorkflowTemplate(templateId: string): WorkflowTemplate | undefined {
    return this.templates.find((template) => template.id === templateId);
  }
}
