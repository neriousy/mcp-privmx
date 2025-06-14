// Chat Components
export { ChatArea } from './components/ChatArea';
export { ChatInput } from './components/ChatInput';
export { ChatMessage } from './components/ChatMessage';
export { EmptyState } from './components/EmptyState';
export { ToolCallCard } from './components/ToolCallCard';

// Chat Hooks
export { useConversations } from './hooks/useConversations';
export { useFileUpload, useDragAndDrop } from './hooks/useFileUpload';
export { useSpeechRecognition } from './hooks/useSpeechRecognition';

// Chat Types (from AI SDK and our custom types)
export type {
  // AI SDK types
  Message,
  CoreMessage,

  // Our custom types
  Conversation,
  ConversationState,
  MessageAttachment,
  AttachedFile,
} from '../../types';
