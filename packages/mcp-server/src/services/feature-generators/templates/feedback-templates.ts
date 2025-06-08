import { WorkflowTemplate, WorkflowCategory } from '../workflow-types';

export const ANONYMOUS_FEEDBACK_SYSTEM: WorkflowTemplate = {
  id: 'anonymous-feedback-system',
  name: 'Anonymous Feedback Portal',
  description:
    'Secure anonymous feedback collection with encryption, moderation, and analytics',
  category: WorkflowCategory.FEEDBACK,
  language: 'javascript',
  features: [
    {
      name: 'Anonymous Submission',
      description: 'Collect feedback without revealing user identity',
      apis: [
        'Inbox.createInbox',
        'Inbox.sendEntry',
        'CryptoApi.generateKeyPair',
      ],
      complexity: 'moderate',
    },
    {
      name: 'Data Serialization',
      description: 'Convert feedback data to Uint8Array format for PrivMX APIs',
      apis: ['Utils.serializeObject', 'Utils.deserializeObject'],
      complexity: 'simple',
    },
    {
      name: 'Moderation Dashboard',
      description: 'Review, categorize, and respond to feedback',
      apis: ['Inbox.listEntries', 'Inbox.readEntry', 'Inbox.deleteEntry'],
      complexity: 'moderate',
    },
    {
      name: 'Analytics & Reporting',
      description: 'Generate insights from feedback data',
      apis: ['Inbox.getInbox', 'Inbox.listEntries'],
      complexity: 'simple',
    },
  ],
  dependencies: [
    {
      name: '@privmx/privmx-webendpoint-sdk',
      version: 'latest',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: 'react',
      version: '^18.0.0',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: 'chart.js',
      version: '^4.4.0',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: 'express',
      version: '^4.18.0',
      type: 'runtime',
      manager: 'npm',
    },
  ],
  files: [],
};

export const EMPLOYEE_FEEDBACK_PLATFORM: WorkflowTemplate = {
  id: 'employee-feedback-platform',
  name: 'Employee Feedback Platform',
  description:
    'Enterprise employee feedback system with surveys, polls, and sentiment analysis',
  category: WorkflowCategory.FEEDBACK,
  language: 'typescript',
  features: [
    {
      name: 'Survey Builder',
      description: 'Create custom surveys with multiple question types',
      apis: ['Inbox.createInbox', 'Thread.createThread'],
      complexity: 'moderate',
    },
    {
      name: 'Response Collection',
      description: 'Collect and organize survey responses securely',
      apis: ['Inbox.sendEntry', 'Inbox.listEntries', 'CryptoApi.encryptData'],
      complexity: 'moderate',
    },
    {
      name: 'Real-time Polls',
      description: 'Live polling with instant results',
      apis: ['Thread.sendMessage', 'Thread.subscribeToMessages'],
      complexity: 'simple',
    },
    {
      name: 'Sentiment Analysis',
      description: 'Analyze feedback sentiment and trends',
      apis: ['Inbox.readEntry', 'Inbox.listEntries'],
      complexity: 'complex',
    },
  ],
  dependencies: [
    {
      name: '@privmx/privmx-webendpoint-sdk',
      version: 'latest',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: 'express',
      version: '^4.18.0',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: '@types/node',
      version: '^20.0.0',
      type: 'dev',
      manager: 'npm',
    },
    {
      name: 'natural',
      version: '^6.5.0',
      type: 'runtime',
      manager: 'npm',
    },
  ],
  files: [],
};

export const feedbackTemplates = [
  ANONYMOUS_FEEDBACK_SYSTEM,
  EMPLOYEE_FEEDBACK_PLATFORM,
];
