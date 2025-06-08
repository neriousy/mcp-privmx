import { WorkflowTemplate, WorkflowCategory } from '../workflow-types';

export const TEAM_COLLABORATION_SUITE: WorkflowTemplate = {
  id: 'team-collaboration-suite',
  name: 'Complete Team Collaboration Suite',
  description:
    'Full-featured team collaboration platform combining messaging, file sharing, and project management',
  category: WorkflowCategory.FULL_STACK,
  language: 'typescript',
  features: [
    {
      name: 'Unified Dashboard',
      description: 'Central hub for all team activities and notifications',
      apis: ['Thread.listThreads', 'Store.listStores', 'Inbox.listInboxes'],
      complexity: 'moderate',
    },
    {
      name: 'Project Spaces',
      description: 'Organized workspaces with threads, files, and tasks',
      apis: ['Thread.createThread', 'Store.createStore', 'Inbox.createInbox'],
      complexity: 'complex',
    },
    {
      name: 'Cross-Platform Sync',
      description: 'Real-time synchronization across all team activities',
      apis: ['Thread.subscribeToMessages', 'Store.subscribeToStoreEvents'],
      complexity: 'complex',
    },
    {
      name: 'Advanced Permissions',
      description: 'Granular role-based access control',
      apis: ['Store.updateStore', 'Thread.updateThread', 'Inbox.updateInbox'],
      complexity: 'moderate',
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
      name: 'next',
      version: '^14.0.0',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: 'socket.io',
      version: '^4.7.0',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: '@types/react',
      version: '^18.0.0',
      type: 'dev',
      manager: 'npm',
    },
  ],
  files: [],
};

export const SECURE_PROJECT_WORKSPACE: WorkflowTemplate = {
  id: 'secure-project-workspace',
  name: 'Secure Project Workspace',
  description:
    'Enterprise project management with encrypted communications and document collaboration',
  category: WorkflowCategory.COLLABORATION,
  language: 'javascript',
  features: [
    {
      name: 'Project Organization',
      description: 'Structure projects with phases, tasks, and milestones',
      apis: ['Thread.createThread', 'Store.createStore'],
      complexity: 'moderate',
    },
    {
      name: 'Document Collaboration',
      description: 'Real-time document editing and version control',
      apis: ['Store.createFile', 'Store.updateFile', 'Thread.sendMessage'],
      complexity: 'complex',
    },
    {
      name: 'Secure Communications',
      description: 'Encrypted team communications and file sharing',
      apis: [
        'CryptoApi.encryptData',
        'CryptoApi.decryptData',
        'Thread.sendMessage',
      ],
      complexity: 'complex',
    },
    {
      name: 'Progress Tracking',
      description: 'Monitor project progress and team performance',
      apis: ['Thread.listMessages', 'Store.listFiles', 'Inbox.listEntries'],
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
      name: 'express',
      version: '^4.18.0',
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
      name: 'recharts',
      version: '^2.8.0',
      type: 'runtime',
      manager: 'npm',
    },
  ],
  files: [],
};

export const collaborationTemplates = [
  TEAM_COLLABORATION_SUITE,
  SECURE_PROJECT_WORKSPACE,
];
