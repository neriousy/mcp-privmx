import { WorkflowTemplate, WorkflowCategory } from '../generation-types.js';

export const SECURE_FILE_EXCHANGE: WorkflowTemplate = {
  id: 'secure-file-exchange',
  name: 'Encrypted File Sharing Platform',
  description:
    'End-to-end encrypted file sharing with access control, expiration, and download tracking',
  category: WorkflowCategory.FILE_SHARING,
  language: 'javascript',
  features: [
    {
      name: 'File Upload',
      description:
        'Upload files with automatic encryption by PrivMX WebEndpoint',
      apis: ['Store.createStore', 'Store.createFile', 'Store.writeToFile'],
      complexity: 'moderate',
    },
    {
      name: 'File Download',
      description:
        'Download files with automatic decryption by PrivMX WebEndpoint',
      apis: ['Store.getFile', 'Store.openFile', 'Store.readFromFile'],
      complexity: 'moderate',
    },
    {
      name: 'Access Control',
      description: 'Permission-based file access and sharing links',
      apis: ['Store.updateStore', 'Store.getStore'],
      complexity: 'moderate',
    },
    {
      name: 'File Management',
      description: 'Organize files, folders, and metadata',
      apis: ['Store.listFiles', 'Store.deleteFile', 'Store.updateFile'],
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
      name: 'multer',
      version: '^1.4.5',
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
      name: 'dropzone',
      version: '^6.0.0',
      type: 'runtime',
      manager: 'npm',
    },
  ],
  files: [],
};

export const TEAM_FILE_WORKSPACE: WorkflowTemplate = {
  id: 'team-file-workspace',
  name: 'Collaborative File Workspace',
  description:
    'Team file sharing with version control, comments, and real-time collaboration',
  category: WorkflowCategory.COLLABORATION,
  language: 'typescript',
  features: [
    {
      name: 'Version Control',
      description: 'Track file versions and changes over time',
      apis: ['Store.createFile', 'Store.updateFile', 'Store.listFiles'],
      complexity: 'complex',
    },
    {
      name: 'File Comments',
      description: 'Add comments and discussions to files',
      apis: ['Thread.createThread', 'Thread.sendMessage'],
      complexity: 'moderate',
    },
    {
      name: 'Real-time Sync',
      description: 'Live updates when files are modified',
      apis: ['Store.subscribeToStoreEvents'],
      complexity: 'moderate',
    },
    {
      name: 'Team Permissions',
      description: 'Role-based access control for team members',
      apis: ['Store.updateStore', 'Store.getStore'],
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
      name: 'socket.io',
      version: '^4.7.0',
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
      name: '@types/express',
      version: '^4.17.0',
      type: 'dev',
      manager: 'npm',
    },
  ],
  files: [],
};

export const fileSharingTemplates = [SECURE_FILE_EXCHANGE, TEAM_FILE_WORKSPACE];
