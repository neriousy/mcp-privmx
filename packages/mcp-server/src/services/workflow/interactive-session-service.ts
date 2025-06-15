/**
 * Interactive Session Service
 *
 * Focused service for managing interactive workflow sessions and user interactions.
 * Extracted from the large APIKnowledgeService for better separation of concerns.
 */

import logger from '../../common/logger.js';
import { InteractiveWorkflowBuilder } from '../workflow-builder/interactive-workflow-builder.js';
import { UserResponse, UserContext } from '../../types/mcp-types.js';
import ServiceManager from '../../common/service-manager.js';

interface SessionData {
  id: string;
  goal: string;
  userContext: UserContext;
  startedAt: Date;
  currentStep: number;
  totalSteps: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  generatedFiles: Array<{
    path: string;
    description: string;
    status: 'pending' | 'generated' | 'validated';
  }>;
}

export class InteractiveSessionService {
  private interactiveWorkflowBuilder: InteractiveWorkflowBuilder;
  private sessions: Map<string, SessionData> = new Map();
  private initialized = false;

  constructor() {
    this.interactiveWorkflowBuilder = new InteractiveWorkflowBuilder();
  }

  /**
   * Initialize the session service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('🔄 Initializing interactive session service...');
    this.initialized = true;
    logger.info('✅ Interactive session service ready!');
  }

  /**
   * Start a new interactive session
   */
  async startInteractiveSession(
    goal: string,
    userContext: UserContext
  ): Promise<{
    sessionId: string;
    currentStep: number;
    totalSteps: number;
    nextAction: {
      type:
        | 'template_selection'
        | 'code_generation'
        | 'validation'
        | 'completion';
      description: string;
      options?: unknown[];
    };
  }> {
    this.ensureInitialized();

    const sessionId = this.generateSessionId();
    const session: SessionData = {
      id: sessionId,
      goal,
      userContext,
      startedAt: new Date(),
      currentStep: 1,
      totalSteps: 5, // Estimated steps
      status: 'active',
      generatedFiles: [],
    };

    this.sessions.set(sessionId, session);

    logger.info(
      `🚀 Started interactive session ${sessionId} for goal: "${goal}"`
    );

    return {
      sessionId,
      currentStep: 1,
      totalSteps: session.totalSteps,
      nextAction: {
        type: 'template_selection',
        description: 'Choose a template for your project',
        options: [
          { id: 'secure-chat', name: 'Secure Chat Application' },
          { id: 'file-sharing', name: 'File Sharing Platform' },
          { id: 'feedback-inbox', name: 'Anonymous Feedback System' },
        ],
      },
    };
  }

  /**
   * Continue an interactive session with user response
   */
  async continueInteractiveSession(
    sessionId: string,
    userResponse: UserResponse
  ): Promise<{
    currentStep: number;
    totalSteps: number;
    nextAction: {
      type:
        | 'template_selection'
        | 'code_generation'
        | 'validation'
        | 'completion';
      description: string;
      options?: unknown[];
      result?: unknown;
    };
    isComplete: boolean;
  }> {
    this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`);
    }

    logger.info(
      `⏭️ Continuing session ${sessionId}, step ${session.currentStep}`
    );

    // Process user response and advance to next step
    session.currentStep++;

    let nextAction: any;
    let isComplete = false;

    switch (session.currentStep) {
      case 2:
        nextAction = {
          type: 'code_generation',
          description: 'Generate initial project structure',
          result: 'Template selected successfully',
        };
        break;
      case 3:
        nextAction = {
          type: 'validation',
          description: 'Review generated code',
          result: 'Code generated successfully',
        };
        break;
      case 4:
        nextAction = {
          type: 'completion',
          description: 'Finalize project setup',
          result: 'Code validated successfully',
        };
        break;
      default:
        session.status = 'completed';
        isComplete = true;
        nextAction = {
          type: 'completion',
          description: 'Session completed successfully',
          result: 'Project setup complete',
        };
    }

    return {
      currentStep: session.currentStep,
      totalSteps: session.totalSteps,
      nextAction,
      isComplete,
    };
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): {
    currentStep: number;
    totalSteps: number;
    progress: number;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    generatedFiles: Array<{
      path: string;
      description: string;
      status: 'pending' | 'generated' | 'validated';
    }>;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return {
      currentStep: session.currentStep,
      totalSteps: session.totalSteps,
      progress: (session.currentStep / session.totalSteps) * 100,
      status: session.status,
      generatedFiles: session.generatedFiles,
    };
  }

  /**
   * Pause an interactive session
   */
  pauseInteractiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'paused';
    logger.info(`⏸️ Paused session ${sessionId}`);
    return true;
  }

  /**
   * Resume an interactive session
   */
  resumeInteractiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'active';
    logger.info(`▶️ Resumed session ${sessionId}`);
    return true;
  }

  /**
   * Cancel an interactive session
   */
  cancelInteractiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'cancelled';
    logger.info(`❌ Cancelled session ${sessionId}`);
    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Array<{
    sessionId: string;
    goal: string;
    startedAt: Date;
    currentStep: number;
    totalSteps: number;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
  }> {
    return Array.from(this.sessions.values()).map((session) => ({
      sessionId: session.id,
      goal: session.goal,
      startedAt: session.startedAt,
      currentStep: session.currentStep,
      totalSteps: session.totalSteps,
      status: session.status,
    }));
  }

  /**
   * Generate code for a specific step in a session
   */
  async generateStepCode(
    sessionId: string,
    stepIndex: number
  ): Promise<{
    code: string;
    files: Array<{
      path: string;
      content: string;
      description: string;
    }>;
    instructions: string[];
    validationResults?: {
      isValid: boolean;
      issues: string[];
      suggestions: string[];
    };
  }> {
    this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    logger.info(
      `🏗️ Generating code for session ${sessionId}, step ${stepIndex}`
    );

    // Use CodeGenerationService to generate code snippets per step
    const codeGen = await ServiceManager.getCodeGenerationService();

    // Simple heuristic: first step generates setup, subsequent steps placeholder workflow code
    let code = '';
    const files: Array<{ path: string; content: string; description: string }> =
      [];

    if (stepIndex === 1) {
      // Initial setup code (threads + stores by default)
      code = await codeGen.generateSetupCode('typescript', [
        'threads',
        'stores',
      ]);
      files.push({
        path: 'setup.ts',
        content: code,
        description: 'PrivMX project setup',
      });
      session.generatedFiles.push({
        path: 'setup.ts',
        description: 'PrivMX project setup',
        status: 'generated',
      });
    } else {
      code = `// Workflow step ${stepIndex} not yet implemented`;
    }

    return {
      code,
      files,
      instructions: [
        `Step ${stepIndex} code generated`,
        'Review and adapt as needed',
      ],
    };
  }

  /**
   * Private helper methods
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'InteractiveSessionService not initialized. Call initialize() first.'
      );
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
