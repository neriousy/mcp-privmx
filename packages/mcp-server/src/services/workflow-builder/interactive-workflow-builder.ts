/**
 * Interactive Workflow Builder - Phase 2
 * Provides step-by-step guided development for PrivMX applications
 */

import {
  WorkflowSession,
  UserContext,
  WorkflowStep,
  InteractiveStep,
  WorkflowProgress,
  SmartTemplate,
  GeneratedFile,
  SkillLevel,
  ProjectType,
  ValidationResult,
} from '../types.js';

export class InteractiveWorkflowBuilder {
  private activeSessions: Map<string, WorkflowSession> = new Map();
  private workflowTemplates: Map<string, WorkflowTemplate> = new Map();
  private stepValidators: Map<string, StepValidator> = new Map();

  constructor() {
    this.loadWorkflowTemplates();
    this.initializeStepValidators();
  }

  /**
   * Start a new interactive workflow session
   */
  startWorkflow(goal: string, context: UserContext): WorkflowSession {
    const sessionId = this.generateSessionId();
    const template = this.selectBestTemplate(goal, context);

    const session: WorkflowSession = {
      id: sessionId,
      goal,
      template,
      steps: this.generateWorkflowSteps(template, context),
      currentStep: 0,
      context,
      generatedFiles: [],
      progress: {
        completedSteps: 0,
        totalSteps: template.workflow.length,
        estimatedTimeRemaining: this.estimateTimeRemaining(template, context),
      },
      startTime: new Date(),
      lastActivity: new Date(),
      status: 'active',
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get the next step in the workflow
   */
  getNextStep(sessionId: string): InteractiveStep | null {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.currentStep >= session.steps.length) {
      return null;
    }

    const workflowStep = session.steps[session.currentStep];
    return this.convertToInteractiveStep(workflowStep, session);
  }

  /**
   * Validate and complete a step
   */
  async validateStep(
    sessionId: string,
    stepData: any
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    generatedFiles?: GeneratedFile[];
    nextStep?: InteractiveStep;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        isValid: false,
        errors: ['Session not found'],
        warnings: [],
      };
    }

    const currentStep = session.steps[session.currentStep];
    const validator = this.stepValidators.get(currentStep.id);

    if (!validator) {
      return {
        isValid: false,
        errors: [`No validator found for step: ${currentStep.id}`],
        warnings: [],
      };
    }

    const validationResult = await validator.validate(
      stepData,
      session.context
    );

    if (validationResult.isValid) {
      // Generate files for this step
      const generatedFiles = await this.generateFilesForStep(
        currentStep,
        stepData,
        session
      );
      session.generatedFiles.push(...generatedFiles);

      // Move to next step
      session.currentStep++;
      session.progress.completedSteps++;
      session.lastActivity = new Date();

      // Update estimated time
      session.progress.estimatedTimeRemaining =
        this.calculateRemainingTime(session);

      // Check if workflow is complete
      if (session.currentStep >= session.steps.length) {
        session.status = 'completed';
      }

      const nextStep = this.getNextStep(sessionId);

      return {
        isValid: true,
        errors: [],
        warnings: validationResult.warnings,
        generatedFiles,
        nextStep: nextStep || undefined,
      };
    }

    return {
      isValid: false,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
    };
  }

  /**
   * Get session progress and status
   */
  getSessionProgress(sessionId: string): WorkflowProgress | null {
    const session = this.activeSessions.get(sessionId);
    return session?.progress || null;
  }

  /**
   * Pause a workflow session
   */
  pauseSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'active') {
      session.status = 'paused';
      session.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * Resume a paused workflow session
   */
  resumeSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'active';
      session.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions(): WorkflowSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Cancel a workflow session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.lastActivity = new Date();
      return this.activeSessions.delete(sessionId);
    }
    return false;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Select the best workflow template based on goal and context
   */
  private selectBestTemplate(
    goal: string,
    context: UserContext
  ): SmartTemplate {
    const goalLower = goal.toLowerCase();

    // Basic template selection logic
    if (goalLower.includes('chat') || goalLower.includes('messaging')) {
      return this.getTemplate('secure-messaging-app');
    } else if (goalLower.includes('file') || goalLower.includes('share')) {
      return this.getTemplate('file-sharing-app');
    } else if (goalLower.includes('inbox') || goalLower.includes('form')) {
      return this.getTemplate('feedback-inbox-app');
    } else {
      // Default to a general PrivMX app
      return this.getTemplate('general-privmx-app');
    }
  }

  /**
   * Get template by ID
   */
  private getTemplate(templateId: string): SmartTemplate {
    const template = this.workflowTemplates.get(templateId);
    if (!template) {
      // Return a default template
      return this.createDefaultTemplate(templateId, {
        skillLevel: SkillLevel.INTERMEDIATE,
      });
    }
    return this.convertToSmartTemplate(template);
  }

  /**
   * Generate workflow steps from template
   */
  private generateWorkflowSteps(
    template: SmartTemplate,
    context: UserContext
  ): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Basic workflow steps for any PrivMX app
    steps.push({
      id: 'setup-connection',
      name: 'Setup PrivMX Connection',
      description: 'Configure PrivMX connection and credentials',
      apiMethod: 'Endpoint.connect',
      parameters: {
        userPrivateKey: '{{userPrivateKey}}',
        solutionId: '{{solutionId}}',
        platformUrl: '{{platformUrl}}',
      },
      prerequisites: [],
      validation: 'connection-established',
      errorHandling: 'connection-error-handler',
      codeSnippet: 'endpoint-connection-snippet',
    });

    // Add framework-specific steps
    if (context.preferredFramework === 'react') {
      steps.push({
        id: 'create-react-component',
        name: 'Create React Component',
        description: 'Generate main React component with PrivMX integration',
        apiMethod: 'React.Component',
        parameters: {
          componentName: '{{componentName}}',
          props: '{{componentProps}}',
        },
        prerequisites: ['setup-connection'],
        validation: 'component-structure',
        errorHandling: 'react-error-boundary',
        codeSnippet: 'react-component-snippet',
      });
    }

    // Add feature-specific steps based on template
    steps.push(...this.generateFeatureSteps(template, context));

    return steps;
  }

  /**
   * Generate feature-specific workflow steps
   */
  private generateFeatureSteps(
    template: SmartTemplate,
    context: UserContext
  ): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Example: Add messaging steps if template includes threads
    if (template.id.includes('messaging') || template.id.includes('chat')) {
      steps.push({
        id: 'setup-threads',
        name: 'Setup Secure Threads',
        description: 'Configure thread API for secure messaging',
        apiMethod: 'ThreadApi.createThread',
        parameters: {
          contextId: '{{contextId}}',
          users: '{{threadUsers}}',
          publicMeta: '{{publicMeta}}',
          privateMeta: '{{privateMeta}}',
        },
        prerequisites: ['setup-connection'],
        validation: 'thread-created',
        errorHandling: 'thread-error-handler',
        codeSnippet: 'thread-creation-snippet',
      });

      steps.push({
        id: 'implement-messaging',
        name: 'Implement Messaging Interface',
        description: 'Create UI for sending and receiving messages',
        apiMethod: 'ThreadApi.sendMessage',
        parameters: {
          threadId: '{{threadId}}',
          publicMeta: '{{messageMeta}}',
          privateMeta: '{{messagePrivateMeta}}',
          data: '{{messageData}}',
        },
        prerequisites: ['setup-threads'],
        validation: 'message-interface',
        errorHandling: 'message-error-handler',
        codeSnippet: 'messaging-interface-snippet',
      });
    }

    return steps;
  }

  /**
   * Convert workflow step to interactive step
   */
  private convertToInteractiveStep(
    workflowStep: WorkflowStep,
    session: WorkflowSession
  ): InteractiveStep {
    return {
      id: workflowStep.id,
      title: workflowStep.name,
      description: workflowStep.description,
      type: this.determineStepType(workflowStep),
      required: true,
      dependencies: workflowStep.prerequisites,
      estimatedTime: this.estimateStepTime(workflowStep, session.context),
      userInput: this.generateUserInputSpec(workflowStep),
      validation: this.generateStepValidation(workflowStep),
    };
  }

  /**
   * Determine the type of interactive step
   */
  private determineStepType(
    workflowStep: WorkflowStep
  ): InteractiveStep['type'] {
    if (
      workflowStep.id.includes('setup') ||
      workflowStep.id.includes('configure')
    ) {
      return 'configure';
    } else if (
      workflowStep.id.includes('create') ||
      workflowStep.id.includes('generate')
    ) {
      return 'generate';
    } else if (
      workflowStep.id.includes('validate') ||
      workflowStep.id.includes('test')
    ) {
      return 'validate';
    } else {
      return 'user_input';
    }
  }

  /**
   * Generate user input specification for a step
   */
  private generateUserInputSpec(workflowStep: WorkflowStep): any {
    const stepId = workflowStep.id;

    if (stepId === 'setup-connection') {
      return {
        type: 'form',
        fields: [
          {
            name: 'bridgeUrl',
            type: 'text',
            prompt: 'Enter your PrivMX Bridge URL',
            placeholder: 'https://your-bridge.privmx.dev',
            validation: { required: true, pattern: '^https?://.+' },
          },
          {
            name: 'solutionId',
            type: 'text',
            prompt: 'Enter your Solution ID',
            placeholder: 'your-solution-id',
            validation: { required: true },
          },
          {
            name: 'userPrivateKey',
            type: 'text',
            prompt: 'Enter your Private Key (WIF format)',
            placeholder: 'L1abc...',
            validation: { required: true },
          },
        ],
      };
    }

    return null;
  }

  /**
   * Generate step validation rules
   */
  private generateStepValidation(workflowStep: WorkflowStep): any {
    return {
      rules: [
        {
          type: 'syntax',
          description: 'Code must be syntactically valid',
          severity: 'error',
          autoFix: false,
        },
      ],
      onFailure: 'retry',
      maxRetries: 3,
    };
  }

  /**
   * Generate files for a completed step
   */
  private async generateFilesForStep(
    step: WorkflowStep,
    stepData: any,
    session: WorkflowSession
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate code based on step type
    if (step.id === 'setup-connection') {
      files.push({
        path: 'src/services/privmx.service.ts',
        content: this.generateConnectionService(stepData, session.context),
        language: session.context.preferences?.typescript
          ? 'typescript'
          : 'javascript',
        framework: session.context.preferredFramework,
        dependencies: ['@privmx/privmx-webendpoint-sdk'],
        description: 'PrivMX connection service',
        lastModified: new Date(),
      });
    }

    return files;
  }

  /**
   * Generate connection service code
   */
  private generateConnectionService(
    connectionData: any,
    context: UserContext
  ): string {
    const isTypeScript = context.preferences?.typescript;
    const extension = isTypeScript ? '.ts' : '.js';

    return `/**
 * PrivMX Connection Service
 * Generated by PrivMX MCP Server
 */

${isTypeScript ? "import { Endpoint } from '@privmx/privmx-webendpoint-sdk';" : "const { Endpoint } = require('@privmx/privmx-webendpoint-sdk');"}

${isTypeScript ? 'interface PrivMXConfig {' : ''}
${isTypeScript ? '  bridgeUrl: string;' : ''}
${isTypeScript ? '  solutionId: string;' : ''}
${isTypeScript ? '  userPrivateKey: string;' : ''}
${isTypeScript ? '}' : ''}

class PrivMXService {
  ${isTypeScript ? 'private endpoint: Endpoint | null = null;' : 'constructor() { this.endpoint = null; }'}
  ${isTypeScript ? 'private connectionId: string | null = null;' : ''}
  ${isTypeScript ? 'private isConnected: boolean = false;' : ''}

  async connect(config${isTypeScript ? ': PrivMXConfig' : ''}) {
    try {
      this.endpoint = new Endpoint();
      this.connectionId = await this.endpoint.connect(
        config.userPrivateKey,
        config.solutionId,
        config.bridgeUrl
      );
      this.isConnected = true;
      console.log('✅ Connected to PrivMX Bridge');
      return this.connectionId;
    } catch (error) {
      console.error('❌ PrivMX connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.endpoint && this.connectionId) {
      await this.endpoint.disconnect(this.connectionId);
      this.isConnected = false;
      console.log('✅ Disconnected from PrivMX Bridge');
    }
  }

  isReady()${isTypeScript ? ': boolean' : ''} {
    return this.isConnected && this.endpoint !== null;
  }
}

${isTypeScript ? 'export default PrivMXService;' : 'module.exports = PrivMXService;'}`;
  }

  /**
   * Estimate time remaining for workflow
   */
  private estimateTimeRemaining(
    template: SmartTemplate,
    context: UserContext
  ): number {
    const baseTimePerStep = this.getBaseTimePerStep(context.skillLevel);
    const remainingSteps = template.workflow.length;
    return remainingSteps * baseTimePerStep;
  }

  /**
   * Calculate remaining time for active session
   */
  private calculateRemainingTime(session: WorkflowSession): number {
    const baseTimePerStep = this.getBaseTimePerStep(session.context.skillLevel);
    const remainingSteps = session.steps.length - session.currentStep;
    return remainingSteps * baseTimePerStep;
  }

  /**
   * Get base time per step based on skill level
   */
  private getBaseTimePerStep(skillLevel: SkillLevel): number {
    switch (skillLevel) {
      case SkillLevel.BEGINNER:
        return 10; // 10 minutes per step
      case SkillLevel.INTERMEDIATE:
        return 5; // 5 minutes per step
      case SkillLevel.EXPERT:
        return 2; // 2 minutes per step
      default:
        return 5;
    }
  }

  /**
   * Estimate time for individual step
   */
  private estimateStepTime(step: WorkflowStep, context: UserContext): number {
    const baseTime = this.getBaseTimePerStep(context.skillLevel);

    // Adjust based on step complexity
    if (step.id.includes('setup') || step.id.includes('configure')) {
      return baseTime * 1.5; // Setup steps take longer
    } else if (step.id.includes('ui') || step.id.includes('interface')) {
      return baseTime * 2; // UI steps take longer
    }

    return baseTime;
  }

  /**
   * Convert WorkflowTemplate to SmartTemplate
   */
  private convertToSmartTemplate(template: WorkflowTemplate): SmartTemplate {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: {
        id: template.category,
        name: template.category,
        description: '',
      },
      frameworks: ['react', 'vue', 'vanilla'], // Default frameworks
      skillLevels: [
        SkillLevel.BEGINNER,
        SkillLevel.INTERMEDIATE,
        SkillLevel.EXPERT,
      ],
      dependencies: [
        {
          name: '@privmx/privmx-webendpoint-sdk',
          version: '^1.0.0',
          type: 'production',
        },
      ],
      files: [],
      workflow: template.steps,
      tags: ['privmx'],
      complexity: 3,
    };
  }

  /**
   * Create a default template for fallback
   */
  private createDefaultTemplate(
    goal: string,
    context: UserContext
  ): SmartTemplate {
    return {
      id: 'default',
      name: 'Default Template',
      description: `Template for: ${goal}`,
      category: {
        id: 'general',
        name: 'General',
        description: 'General purpose template',
      },
      frameworks: [context.preferredFramework || 'vanilla'],
      skillLevels: [context.skillLevel],
      dependencies: [],
      files: [],
      workflow: [],
      tags: ['default'],
      complexity: context.skillLevel === SkillLevel.BEGINNER ? 3 : 6,
    };
  }

  /**
   * Load workflow templates (placeholder)
   */
  private loadWorkflowTemplates(): void {
    // This would load templates from a template library
    console.log('Loading workflow templates...');
  }

  /**
   * Initialize step validators
   */
  private initializeStepValidators(): void {
    // Register validators for different step types
    this.stepValidators.set('setup-connection', new ConnectionValidator());
    this.stepValidators.set(
      'create-react-component',
      new ReactComponentValidator()
    );
    // Add more validators as needed
  }

  /**
   * Start a new interactive development session
   */
  async startSession(
    goal: string,
    userContext: {
      skillLevel: 'beginner' | 'intermediate' | 'advanced';
      preferredLanguage: string;
      frameworks?: string[];
      projectType?: 'prototype' | 'production' | 'learning';
    }
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
      options?: any[];
    };
  }> {
    const sessionId = this.generateSessionId();

    // Create user context
    const context: UserContext = {
      skillLevel: userContext.skillLevel as SkillLevel,
      preferredFramework: userContext.frameworks?.[0],
      projectType: userContext.projectType as ProjectType,
    };

    // Create default template and generate workflow steps
    const template = this.createDefaultTemplate(goal, context);
    const steps = this.generateWorkflowSteps(template, context);

    // Create session
    const session: WorkflowSession = {
      id: sessionId,
      goal,
      template,
      steps,
      currentStep: 0,
      context,
      generatedFiles: [],
      progress: {
        completedSteps: 0,
        totalSteps: steps.length,
      },
      startTime: new Date(),
      lastActivity: new Date(),
      status: 'active',
    };

    this.activeSessions.set(sessionId, session);

    return {
      sessionId,
      currentStep: 0,
      totalSteps: steps.length,
      nextAction: {
        type: 'template_selection',
        description: 'Choose a template that best matches your project goals',
        options: this.getTemplateOptions(context),
      },
    };
  }

  /**
   * Process user response and continue session
   */
  async processUserResponse(
    sessionId: string,
    userResponse: any
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
      options?: any[];
      result?: any;
    };
    isComplete: boolean;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Process the current step with user response
    const currentStep = session.steps[session.currentStep];
    const stepResult = await this.processStepResponse(
      currentStep,
      userResponse,
      session
    );

    // Update session progress
    session.currentStep++;
    session.progress.completedSteps++;
    session.lastActivity = new Date();

    // Check if session is complete
    const isComplete = session.currentStep >= session.steps.length;
    if (isComplete) {
      session.status = 'completed';
    }

    // Determine next action
    let nextAction;
    if (isComplete) {
      nextAction = {
        type: 'completion' as const,
        description: 'Workflow completed successfully!',
        result: {
          generatedFiles: session.generatedFiles,
          summary: this.generateSessionSummary(session),
        },
      };
    } else {
      const nextStep = session.steps[session.currentStep];
      nextAction = {
        type: this.getStepActionType(nextStep),
        description: nextStep.description,
        options: this.getStepOptions(nextStep, session),
      };
    }

    return {
      currentStep: session.currentStep,
      totalSteps: session.steps.length,
      nextAction,
      isComplete,
    };
  }

  /**
   * Get session status and progress
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
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      currentStep: session.currentStep,
      totalSteps: session.steps.length,
      progress: (session.currentStep / session.steps.length) * 100,
      status:
        session.status === 'failed'
          ? 'cancelled'
          : (session.status as 'active' | 'paused' | 'completed' | 'cancelled'),
      generatedFiles: session.generatedFiles.map((file) => ({
        path: file.path,
        description: file.description || 'Generated file',
        status: 'generated' as const,
      })),
    };
  }

  /**
   * Generate code for specific workflow step
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
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (stepIndex >= session.steps.length) {
      throw new Error(`Step index out of range: ${stepIndex}`);
    }

    const step = session.steps[stepIndex];

    // Generate code for this step
    const code = await this.generateCodeForStep(step, session);

    // Generate files if needed
    const files = await this.generateFilesForStep(step, {}, session);

    // Get instructions for this step
    const instructions = this.getStepInstructions(step, session);

    // Validate the generated code
    const validationResults = await this.validateStepCode(code, step, session);

    return {
      code,
      files: files.map((file) => ({
        path: file.path,
        content: file.content,
        description: file.description || 'Generated file',
      })),
      instructions,
      validationResults,
    };
  }

  private getTemplateOptions(context: UserContext): any[] {
    return [
      {
        id: 'react-app',
        name: 'React Application',
        description: 'Modern React app with TypeScript',
      },
      {
        id: 'node-api',
        name: 'Node.js API',
        description: 'RESTful API with Express',
      },
      {
        id: 'vanilla-js',
        name: 'Vanilla JavaScript',
        description: 'Pure JavaScript implementation',
      },
    ];
  }

  private async processStepResponse(
    step: WorkflowStep,
    response: any,
    session: WorkflowSession
  ): Promise<any> {
    // Process user response for the current step
    console.log(`Processing step ${step.id} with response:`, response);
    return response;
  }

  private getStepActionType(
    step: WorkflowStep
  ): 'template_selection' | 'code_generation' | 'validation' | 'completion' {
    if (step.id === 'setup') return 'template_selection';
    if (step.validation) return 'validation';
    return 'code_generation';
  }

  private getStepOptions(step: WorkflowStep, session: WorkflowSession): any[] {
    return [];
  }

  private generateSessionSummary(session: WorkflowSession): string {
    return `Completed ${session.goal} with ${session.generatedFiles.length} files generated.`;
  }

  private async generateCodeForStep(
    step: WorkflowStep,
    session: WorkflowSession
  ): Promise<string> {
    return `// Generated code for step: ${step.name}\n// ${step.description}\n\nconsole.log('Step ${step.id} implementation');`;
  }

  private getStepInstructions(
    step: WorkflowStep,
    session: WorkflowSession
  ): string[] {
    return [
      'Review the generated code',
      'Test the implementation',
      'Make any necessary adjustments',
    ];
  }

  private async validateStepCode(
    code: string,
    step: WorkflowStep,
    session: WorkflowSession
  ): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    // Basic validation - could be enhanced with actual code analysis
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!code.trim()) {
      issues.push('Code is empty');
    }

    if (code.includes('console.log')) {
      suggestions.push('Consider using proper logging instead of console.log');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }
}

// Placeholder interfaces for workflow types
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  category: string;
  estimatedTime: number;
}

interface StepValidator {
  validate(stepData: any, context: UserContext): Promise<ValidationResult>;
}

// Basic validator implementations
class ConnectionValidator implements StepValidator {
  async validate(
    stepData: any,
    context: UserContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!stepData.bridgeUrl) {
      errors.push('Bridge URL is required');
    } else if (!stepData.bridgeUrl.startsWith('http')) {
      errors.push('Bridge URL must start with http:// or https://');
    }

    if (!stepData.solutionId) {
      errors.push('Solution ID is required');
    }

    if (!stepData.userPrivateKey) {
      errors.push('Private Key is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: ['Make sure your PrivMX credentials are correct'],
    };
  }
}

class ReactComponentValidator implements StepValidator {
  async validate(
    stepData: any,
    context: UserContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!stepData.componentName) {
      errors.push('Component name is required');
    } else if (!/^[A-Z][A-Za-z0-9]*$/.test(stepData.componentName)) {
      errors.push(
        'Component name must start with uppercase letter and contain only alphanumeric characters'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: ['Use PascalCase for React component names'],
    };
  }
}

// Already exported at class declaration
