import {
  WorkflowTemplate,
  WorkflowCategory,
  WorkflowFeature,
  WorkflowDependency,
} from '../workflow-types';

// Example implementation showing correct PrivMX usage patterns
const MESSAGING_APP_EXAMPLE = `
// Example: Creating and sending a message
const createMessage = async (threadId: string, title: string, content: string) => {
  const threadApi = await client.getThreadApi();
  
  // PrivMX automatically encrypts the data - no manual encryption needed
  await threadApi.sendMessage(
    threadId,
    new Uint8Array(), // Public Meta (not encrypted)
    Utils.serializeObject({ title }), // Private Meta (automatically encrypted)
    Utils.serializeObject({ content }) // Data (automatically encrypted)
  );
};

// Example: Reading and displaying messages
const readMessages = async (threadId: string) => {
  const threadApi = await client.getThreadApi();
  const messages = await threadApi.listMessages(threadId, {
    limit: 100,
    skip: 0,
    sortOrder: 'desc'
  });
  
  // PrivMX automatically decrypts the data
  return messages.readItems.map(message => ({
    id: message.info.messageId,
    title: Utils.deserializeObject(message.privateMeta).title,
    content: Utils.deserializeObject(message.data).content,
    timestamp: message.info.createDate
  }));
};

// Example: User authentication with key derivation
const signIn = async (username: string, password: string) => {
  const cryptoApi = await PrivmxClient.getCryptoApi();
  
  // Derive keys from credentials (for authentication, not manual encryption)
  const privateKey = await cryptoApi.derivePrivateKey2(username, password);
  
  // Connect to PrivMX (encryption handled automatically)
  const connection = await PrivmxClient.connect(
    privateKey,
    solutionId,
    bridgeUrl
  );
  
  return connection;
};
`;

export const SECURE_MESSAGING_APP: WorkflowTemplate = {
  id: 'secure-messaging-app',
  name: 'Secure Messaging Application',
  description:
    'Complete end-to-end encrypted messaging app with real-time chat, user authentication, and thread management. All encryption handled automatically by PrivMX WebEndpoint.',
  category: WorkflowCategory.MESSAGING,
  language: 'javascript', // Default, can be overridden
  features: [
    {
      name: 'Real-time Messaging',
      description: 'Instant message delivery with WebSocket support',
      apis: [
        'Thread.sendMessage',
        'Thread.getMessage',
        'Thread.subscribeToMessages',
      ],
      complexity: 'moderate',
    },
    {
      name: 'Data Handling',
      description:
        'Convert JavaScript objects to/from Uint8Array for PrivMX APIs',
      apis: ['Utils.serializeObject', 'Utils.deserializeObject'],
      complexity: 'simple',
    },
    {
      name: 'User Authentication',
      description: 'Secure user registration and login with key derivation',
      apis: [
        'CryptoApi.derivePrivateKey2',
        'CryptoApi.derivePublicKey',
        'Connection.connect',
      ],
      complexity: 'moderate',
    },
    {
      name: 'Thread Management',
      description: 'Create, join, and manage conversation threads',
      apis: [
        'Thread.createThread',
        'Thread.getThread',
        'Thread.updateThread',
        'Thread.deleteThread',
      ],
      complexity: 'simple',
    },
  ],
  dependencies: [
    {
      name: '@simplito/privmx-webendpoint',
      version: 'latest',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: 'socket.io-client',
      version: '^4.7.0',
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
      name: 'tailwindcss',
      version: '^3.3.0',
      type: 'dev',
      manager: 'npm',
    },
  ],
  files: [],
};

export const TEAM_CHAT_SYSTEM: WorkflowTemplate = {
  id: 'team-chat-system',
  name: 'Enterprise Team Chat System',
  description:
    'Multi-channel team communication platform with file sharing and presence indicators',
  category: WorkflowCategory.COLLABORATION,
  language: 'typescript',
  features: [
    {
      name: 'Multi-Channel Support',
      description: 'Organize conversations into different channels/threads',
      apis: ['Thread.createThread', 'Thread.listThreads', 'Thread.getThread'],
      complexity: 'moderate',
    },
    {
      name: 'File Sharing',
      description: 'Upload and share files within conversations',
      apis: [
        'Store.createStore',
        'Store.createFile',
        'Store.getFile',
        'Store.deleteFile',
      ],
      complexity: 'moderate',
    },
    {
      name: 'Presence Indicators',
      description: 'Show online/offline status and typing indicators',
      apis: ['Thread.subscribeToMessages'],
      complexity: 'simple',
    },
    {
      name: 'Message History',
      description: 'Search and browse message history',
      apis: ['Thread.listMessages', 'Thread.getMessage'],
      complexity: 'simple',
    },
  ],
  dependencies: [
    {
      name: '@simplito/privmx-webendpoint',
      version: 'latest',
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
      name: 'express',
      version: '^4.18.0',
      type: 'runtime',
      manager: 'npm',
    },
    {
      name: 'ws',
      version: '^8.14.0',
      type: 'runtime',
      manager: 'npm',
    },
  ],
  files: [],
};

export const messagingTemplates = [SECURE_MESSAGING_APP, TEAM_CHAT_SYSTEM];
