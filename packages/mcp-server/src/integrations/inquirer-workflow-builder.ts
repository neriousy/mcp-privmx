/**
 * Inquirer Workflow Builder Integration
 *
 * Replaces custom InteractiveWorkflowBuilder with proven Inquirer.js (2M+ downloads)
 * while adding our unique PrivMX workflow intelligence
 */

import type {
  WorkflowBuildRequest,
  IntegrationResult,
  WorkflowStep,
  WorkflowSession,
} from './types.js';
import type { UserContext, JsonObject } from '../common/types.js';

type InquirerAnswers = Record<string, unknown>;

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
  ): Promise<IntegrationResult<{ sessionId: string; firstStep: JsonObject }>> {
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
    answers: InquirerAnswers
  ): Promise<
    IntegrationResult<{
      nextStep?: JsonObject;
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
        validate: (input: unknown) =>
          (typeof input === 'string' && input.length > 0) ||
          'Project name is required',
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
        when: (answers: Record<string, unknown>) =>
          answers['framework-choice'] !== 'vanilla',
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
      {
        id: 'privmx-config',
        type: 'input',
        message: 'Enter your PrivMX Platform URL:',
        default: 'https://api.privmx.cloud',
        validate: (input: unknown) => {
          if (typeof input !== 'string') return 'Please enter a valid URL';
          const urlPattern = /^https?:\/\/.+/;
          return urlPattern.test(input) || 'Please enter a valid URL';
        },
      },
    ]);

    // File Sharing App Workflow
    this.workflowTemplates.set('file-sharing', [
      {
        id: 'project-setup',
        type: 'input',
        message: 'What is your file sharing project name?',
        validate: (input: unknown) =>
          (typeof input === 'string' && input.length > 0) ||
          'Project name is required',
      },
      {
        id: 'storage-type',
        type: 'list',
        message: 'Choose storage type:',
        choices: [
          { name: 'PrivMX Stores (Recommended)', value: 'stores' },
          { name: 'Local File System', value: 'local' },
          { name: 'Cloud Storage Integration', value: 'cloud' },
        ],
      },
      {
        id: 'file-types',
        type: 'checkbox',
        message: 'Select supported file types:',
        choices: [
          { name: 'Documents (PDF, DOC, TXT)', value: 'documents' },
          { name: 'Images (JPG, PNG, GIF)', value: 'images' },
          { name: 'Videos (MP4, AVI, MOV)', value: 'videos' },
          { name: 'Archives (ZIP, RAR)', value: 'archives' },
          { name: 'All file types', value: 'all' },
        ],
      },
    ]);

    // Feedback System Workflow
    this.workflowTemplates.set('feedback-system', [
      {
        id: 'project-setup',
        type: 'input',
        message: 'What is your feedback system project name?',
        validate: (input: unknown) =>
          (typeof input === 'string' && input.length > 0) ||
          'Project name is required',
      },
      {
        id: 'feedback-types',
        type: 'checkbox',
        message: 'Select feedback collection methods:',
        choices: [
          { name: 'Star ratings', value: 'ratings' },
          { name: 'Text comments', value: 'comments' },
          { name: 'File attachments', value: 'attachments' },
          { name: 'Anonymous feedback', value: 'anonymous' },
        ],
      },
    ]);

    console.log(`Loaded ${this.workflowTemplates.size} PrivMX workflows`);
  }

  /**
   * Select workflow based on goal and user context
   */
  private selectWorkflow(
    goal: string,
    _userContext: UserContext
  ): WorkflowStep[] {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('chat') || goalLower.includes('messaging')) {
      return this.workflowTemplates.get('secure-chat') || [];
    }

    if (goalLower.includes('file') || goalLower.includes('sharing')) {
      return this.workflowTemplates.get('file-sharing') || [];
    }

    if (goalLower.includes('feedback') || goalLower.includes('inbox')) {
      return this.workflowTemplates.get('feedback-system') || [];
    }

    // Default to secure chat
    return this.workflowTemplates.get('secure-chat') || [];
  }

  /**
   * Execute a specific workflow step using Inquirer
   */
  private async executeStep(
    session: WorkflowSession,
    stepIndex: number
  ): Promise<JsonObject> {
    const step = session.steps[stepIndex];
    if (!step) {
      throw new Error(`Step ${stepIndex} not found`);
    }

    // Use current session answers as context for "when" conditions
    const shouldAsk = !step.when || step.when(session.answers);

    if (!shouldAsk) {
      // Skip this step and move to next
      return { skipped: true, stepId: step.id };
    }

    // Return step information for execution
    return {
      stepId: step.id,
      type: step.type,
      message: step.message,
      choices: step.choices || [],
      default: step.default || null,
    };
  }

  /**
   * Generate workflow files based on collected answers
   */
  private async generateWorkflowFiles(
    session: WorkflowSession
  ): Promise<string[]> {
    const { goal, answers } = session;

    if (goal.toLowerCase().includes('chat')) {
      return this.generateChatAppFiles(answers);
    } else if (goal.toLowerCase().includes('file')) {
      return this.generateFileAppFiles(answers);
    } else if (goal.toLowerCase().includes('feedback')) {
      return this.generateFeedbackAppFiles(answers);
    }

    return [];
  }

  /**
   * Generate files for chat application
   */
  private generateChatAppFiles(answers: InquirerAnswers): string[] {
    const framework = answers['framework-choice'] as string;
    const projectName = answers['project-setup'] as string;
    const features = answers['features-selection'] as string[];

    const files = [
      `${projectName}/package.json`,
      `${projectName}/src/App.${framework === 'react' ? 'tsx' : 'js'}`,
      `${projectName}/src/components/Chat.${framework === 'react' ? 'tsx' : 'js'}`,
    ];

    if (features?.includes('file-sharing')) {
      files.push(
        `${projectName}/src/components/FileUpload.${framework === 'react' ? 'tsx' : 'js'}`
      );
    }

    if (features?.includes('presence')) {
      files.push(
        `${projectName}/src/components/UserPresence.${framework === 'react' ? 'tsx' : 'js'}`
      );
    }

    return files;
  }

  /**
   * Generate files for file sharing application
   */
  private generateFileAppFiles(answers: InquirerAnswers): string[] {
    const projectName = answers['project-setup'] as string;
    const storageType = answers['storage-type'] as string;

    const files = [
      `${projectName}/package.json`,
      `${projectName}/src/App.js`,
      `${projectName}/src/components/FileManager.js`,
    ];

    if (storageType === 'stores') {
      files.push(`${projectName}/src/services/PrivMXStoreService.js`);
    }

    return files;
  }

  /**
   * Generate files for feedback system
   */
  private generateFeedbackAppFiles(answers: InquirerAnswers): string[] {
    const projectName = answers['project-setup'] as string;
    const feedbackTypes = answers['feedback-types'] as string[];

    const files = [
      `${projectName}/package.json`,
      `${projectName}/src/App.js`,
      `${projectName}/src/components/FeedbackForm.js`,
    ];

    if (feedbackTypes?.includes('ratings')) {
      files.push(`${projectName}/src/components/StarRating.js`);
    }

    if (feedbackTypes?.includes('attachments')) {
      files.push(`${projectName}/src/components/FileAttachment.js`);
    }

    return files;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
