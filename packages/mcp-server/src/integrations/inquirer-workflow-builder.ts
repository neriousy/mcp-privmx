/**
 * Inquirer Workflow Builder Integration
 *
 * Replaces custom InteractiveWorkflowBuilder with proven Inquirer.js (2M+ downloads)
 * while adding our unique PrivMX workflow intelligence
 */

import inquirer from 'inquirer';
import type {
  WorkflowBuildRequest,
  IntegrationResult,
  WorkflowStep,
  WorkflowSession,
} from './types.js';

export class InquirerWorkflowBuilder {
  private workflowTemplates: Map<string, WorkflowStep[]> = new Map();
  private activeSessions: Map<string, WorkflowSession> = new Map();

  constructor() {
    this.loadPrivMXWorkflows();
  }

  /**
   * Start an interactive PrivMX workflow using Inquirer
   */
  async startWorkflow(
    request: WorkflowBuildRequest
  ): Promise<IntegrationResult<{ sessionId: string; firstStep: any }>> {
    const startTime = Date.now();

    try {
      // Generate session ID
      const sessionId = this.generateSessionId();

      // Select workflow based on goal
      const workflowSteps = this.selectWorkflow(
        request.goal,
        request.userContext
      );

      // Create session
      const session: WorkflowSession = {
        id: sessionId,
        goal: request.goal,
        steps: workflowSteps,
        currentStep: 0,
        answers: {},
        generatedFiles: [],
        status: 'active',
      };

      this.activeSessions.set(sessionId, session);

      // Execute first step with Inquirer
      const firstStep = await this.executeStep(session, 0);

      return {
        success: true,
        data: { sessionId, firstStep },
        metadata: {
          toolUsed: 'inquirer',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `Workflow start failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        metadata: {
          toolUsed: 'inquirer',
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Continue workflow to next step
   */
  async continueWorkflow(
    sessionId: string,
    answers: any
  ): Promise<
    IntegrationResult<{
      nextStep?: any;
      isComplete: boolean;
      generatedFiles?: string[];
    }>
  > {
    const startTime = Date.now();

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          errors: [`Session not found: ${sessionId}`],
          metadata: { toolUsed: 'inquirer' },
        };
      }

      // Store answers from current step
      Object.assign(session.answers, answers);

      // Move to next step
      session.currentStep++;

      // Check if workflow is complete
      if (session.currentStep >= session.steps.length) {
        session.status = 'completed';

        // Generate final files based on collected answers
        const generatedFiles = await this.generateWorkflowFiles(session);
        session.generatedFiles = generatedFiles;

        return {
          success: true,
          data: { isComplete: true, generatedFiles },
          metadata: {
            toolUsed: 'inquirer',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Execute next step
      const nextStep = await this.executeStep(session, session.currentStep);

      return {
        success: true,
        data: { nextStep, isComplete: false },
        metadata: {
          toolUsed: 'inquirer',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `Workflow continuation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        metadata: {
          toolUsed: 'inquirer',
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Get workflow session status
   */
  getSessionStatus(sessionId: string): WorkflowSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Load PrivMX-specific workflows
   */
  private loadPrivMXWorkflows(): void {
    // Secure Chat App Workflow
    this.workflowTemplates.set('secure-chat', [
      {
        id: 'project-setup',
        type: 'input',
        message: 'What is your project name?',
        validate: (input: string) =>
          input.length > 0 || 'Project name is required',
      },
      {
        id: 'framework-choice',
        type: 'list',
        message: 'Choose your frontend framework:',
        choices: [
          { name: 'React (Recommended)', value: 'react' },
          { name: 'Vue.js', value: 'vue' },
          { name: 'Vanilla JavaScript', value: 'vanilla' },
        ],
      },
      {
        id: 'typescript-choice',
        type: 'confirm',
        message: 'Use TypeScript?',
        when: (answers: any) => answers['framework-choice'] !== 'vanilla',
      },
      {
        id: 'features-selection',
        type: 'checkbox',
        message: 'Select chat features to include:',
        choices: [
          { name: 'Real-time messaging', value: 'realtime' },
          { name: 'File sharing in chat', value: 'file-sharing' },
          { name: 'User presence indicators', value: 'presence' },
          { name: 'Message encryption display', value: 'encryption-ui' },
          { name: 'Chat history', value: 'history' },
        ],
      },
      {
        id: 'security-level',
        type: 'list',
        message: 'Choose security level:',
        choices: [
          { name: 'Basic (Good for prototypes)', value: 'basic' },
          { name: 'Standard (Recommended)', value: 'standard' },
          { name: 'High (Maximum security)', value: 'high' },
        ],
      },
    ]);

    // File Sharing App Workflow
    this.workflowTemplates.set('file-sharing', [
      {
        id: 'project-setup',
        type: 'input',
        message: 'What is your project name?',
        validate: (input: string) =>
          input.length > 0 || 'Project name is required',
      },
      {
        id: 'app-type',
        type: 'list',
        message: 'What type of file sharing app?',
        choices: [
          { name: 'Personal file storage', value: 'personal' },
          { name: 'Team collaboration', value: 'team' },
          { name: 'Public file sharing', value: 'public' },
        ],
      },
      {
        id: 'file-features',
        type: 'checkbox',
        message: 'Select file features:',
        choices: [
          { name: 'File upload with progress', value: 'upload-progress' },
          { name: 'File preview', value: 'preview' },
          { name: 'Download management', value: 'download-mgmt' },
          { name: 'Access permissions', value: 'permissions' },
          { name: 'Version control', value: 'versioning' },
        ],
      },
      {
        id: 'storage-settings',
        type: 'input',
        message: 'Maximum file size (MB)?',
        default: '100',
        validate: (input: string) =>
          !isNaN(Number(input)) || 'Must be a number',
      },
    ]);

    // Feedback Inbox Workflow
    this.workflowTemplates.set('feedback-inbox', [
      {
        id: 'project-setup',
        type: 'input',
        message: 'What is your project name?',
        validate: (input: string) =>
          input.length > 0 || 'Project name is required',
      },
      {
        id: 'inbox-type',
        type: 'list',
        message: 'Type of feedback system?',
        choices: [
          { name: 'Anonymous feedback', value: 'anonymous' },
          { name: 'Customer support', value: 'support' },
          { name: 'Bug reports', value: 'bugs' },
          { name: 'General contact form', value: 'contact' },
        ],
      },
      {
        id: 'admin-features',
        type: 'checkbox',
        message: 'Admin dashboard features:',
        choices: [
          { name: 'Response management', value: 'responses' },
          { name: 'Analytics & reporting', value: 'analytics' },
          { name: 'Export functionality', value: 'export' },
          { name: 'Auto-categorization', value: 'categorization' },
        ],
      },
    ]);

    console.log(`Loaded ${this.workflowTemplates.size} PrivMX workflows`);
  }

  /**
   * Select appropriate workflow based on goal
   */
  private selectWorkflow(goal: string, userContext: any): WorkflowStep[] {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('chat') || goalLower.includes('message')) {
      return this.workflowTemplates.get('secure-chat') || [];
    } else if (
      goalLower.includes('file') ||
      goalLower.includes('share') ||
      goalLower.includes('storage')
    ) {
      return this.workflowTemplates.get('file-sharing') || [];
    } else if (
      goalLower.includes('feedback') ||
      goalLower.includes('form') ||
      goalLower.includes('inbox')
    ) {
      return this.workflowTemplates.get('feedback-inbox') || [];
    }

    // Default to secure chat if unclear
    return this.workflowTemplates.get('secure-chat') || [];
  }

  /**
   * Execute a workflow step using Inquirer
   */
  private async executeStep(
    session: WorkflowSession,
    stepIndex: number
  ): Promise<any> {
    const step = session.steps[stepIndex];
    if (!step) {
      throw new Error(`Step ${stepIndex} not found`);
    }

    // Create Inquirer prompt
    const prompt = {
      type: step.type,
      name: step.id,
      message: step.message,
      choices: step.choices,
      when: step.when,
      validate: step.validate,
    };

    // Execute prompt with current session context
    const answers = await inquirer.prompt([prompt], session.answers);

    return {
      stepId: step.id,
      prompt,
      progress: {
        current: stepIndex + 1,
        total: session.steps.length,
        percentage: Math.round(((stepIndex + 1) / session.steps.length) * 100),
      },
    };
  }

  /**
   * Generate files based on workflow answers
   */
  private async generateWorkflowFiles(
    session: WorkflowSession
  ): Promise<string[]> {
    const files: string[] = [];

    // Generate files based on goal and answers
    if (session.goal.toLowerCase().includes('chat')) {
      files.push(...this.generateChatAppFiles(session.answers));
    } else if (session.goal.toLowerCase().includes('file')) {
      files.push(...this.generateFileAppFiles(session.answers));
    } else if (session.goal.toLowerCase().includes('feedback')) {
      files.push(...this.generateFeedbackAppFiles(session.answers));
    }

    return files;
  }

  /**
   * Generate chat app files
   */
  private generateChatAppFiles(answers: any): string[] {
    const framework = answers['framework-choice'] || 'react';
    const useTypeScript = answers['typescript-choice'] || false;
    const features = answers['features-selection'] || [];

    const files = [
      `src/App.${useTypeScript ? 'tsx' : 'jsx'}`,
      `src/components/ChatRoom.${useTypeScript ? 'tsx' : 'jsx'}`,
      `src/services/privmxService.${useTypeScript ? 'ts' : 'js'}`,
      'package.json',
      '.env.example',
    ];

    // Add feature-specific files
    if (features.includes('file-sharing')) {
      files.push(`src/components/FileUpload.${useTypeScript ? 'tsx' : 'jsx'}`);
    }
    if (features.includes('presence')) {
      files.push(
        `src/components/UserPresence.${useTypeScript ? 'tsx' : 'jsx'}`
      );
    }

    return files;
  }

  /**
   * Generate file sharing app files
   */
  private generateFileAppFiles(answers: any): string[] {
    const files = [
      'src/App.tsx',
      'src/components/FileUploader.tsx',
      'src/components/FileList.tsx',
      'src/services/fileService.ts',
      'package.json',
      '.env.example',
    ];

    const features = answers['file-features'] || [];
    if (features.includes('preview')) {
      files.push('src/components/FilePreview.tsx');
    }
    if (features.includes('permissions')) {
      files.push('src/components/PermissionManager.tsx');
    }

    return files;
  }

  /**
   * Generate feedback app files
   */
  private generateFeedbackAppFiles(answers: any): string[] {
    const files = [
      'src/App.tsx',
      'src/components/FeedbackForm.tsx',
      'src/services/inboxService.ts',
      'package.json',
      '.env.example',
    ];

    const adminFeatures = answers['admin-features'] || [];
    if (adminFeatures.includes('responses')) {
      files.push('src/components/AdminDashboard.tsx');
    }
    if (adminFeatures.includes('analytics')) {
      files.push('src/components/Analytics.tsx');
    }

    return files;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
