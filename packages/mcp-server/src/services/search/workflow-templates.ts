import { WorkflowSuggestion } from '../../types/index.js';

export function createMessagingWorkflow(): WorkflowSuggestion {
  return {
    id: 'secure-messaging',
    name: 'Secure Messaging Application',
    description: 'Build a complete secure messaging app with PrivMX',
    estimatedTime: '30-45 minutes',
    difficulty: 'intermediate',
    tags: ['messaging', 'threads', 'real-time'],
    steps: [
      {
        id: 'setup-endpoint',
        name: 'Initialize Endpoint',
        description: 'Set up PrivMX endpoint',
        apiMethod: 'Endpoint.setup',
        parameters: { publicPath: 'string' },
        prerequisites: [],
      },
      {
        id: 'establish-connection',
        name: 'Connect to Bridge',
        description: 'Establish connection to PrivMX Bridge',
        apiMethod: 'Endpoint.connect',
        parameters: {
          userPrivKey: 'string',
          solutionId: 'string',
          bridgeUrl: 'string',
        },
        prerequisites: ['setup-endpoint'],
      },
      {
        id: 'create-thread-api',
        name: 'Create Thread API',
        description: 'Initialize Thread API instance',
        apiMethod: 'Endpoint.createThreadApi',
        parameters: { connection: 'Connection' },
        prerequisites: ['establish-connection'],
      },
      {
        id: 'create-thread',
        name: 'Create Secure Thread',
        description: 'Create a new thread for messaging',
        apiMethod: 'ThreadApi.createThread',
        parameters: {
          contextId: 'string',
          users: 'UserWithPubKey[]',
          managers: 'UserWithPubKey[]',
        },
        prerequisites: ['create-thread-api'],
      },
      {
        id: 'setup-events',
        name: 'Set up Event Listeners',
        description: 'Listen for real-time message events',
        apiMethod: 'EventQueue.addEventListener',
        parameters: { eventType: 'string', handler: 'function' },
        prerequisites: ['create-thread'],
      },
    ],
  };
}

export function createFileStorageWorkflow(): WorkflowSuggestion {
  return {
    id: 'file-storage',
    name: 'Secure File Storage',
    description: 'Build a secure file storage system',
    estimatedTime: '20-30 minutes',
    difficulty: 'beginner',
    tags: ['files', 'storage', 'encryption'],
    steps: [
      // TODO: flesh out with real guidance or remove template until ready
    ],
  };
}

export function createInboxWorkflow(): WorkflowSuggestion {
  return {
    id: 'inbox-system',
    name: 'Inbox Notification System',
    description: 'Build an inbox for notifications',
    estimatedTime: '25-35 minutes',
    difficulty: 'intermediate',
    tags: ['inbox', 'notifications'],
    steps: [
      // TODO: flesh out with real guidance or remove template until ready
    ],
  };
}

export function createEventHandlingWorkflow(): WorkflowSuggestion {
  return {
    id: 'event-handling',
    name: 'Real-time Event Handling',
    description: 'Set up real-time event processing',
    estimatedTime: '15-25 minutes',
    difficulty: 'beginner',
    tags: ['events', 'real-time'],
    steps: [
      // TODO: flesh out with real guidance or remove template until ready
    ],
  };
}
