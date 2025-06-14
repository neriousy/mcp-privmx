// ===== AI SDK TYPES (Re-export from @ai-sdk) =====

import { Message } from 'ai';

// Import the types that are actually available from the AI SDK
export type {
  // Message type from AI SDK (this is the main message interface)
  Message,

  // Hook types that are available
  // Note: We'll use the actual available types from useChat
} from '@ai-sdk/react';

// Re-export from 'ai' package for more comprehensive types
export type {
  CoreMessage,
  CoreSystemMessage,
  CoreUserMessage,
  CoreAssistantMessage,
  CoreToolMessage,
} from 'ai';

// ===== SHARED TYPES =====
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  image?: string;
}

// ===== CHAT TYPES (Extended from AI SDK) =====
// Use AI SDK's Message type as base, extend if needed
export interface MessageAttachment {
  name: string;
  contentType: string;
  url: string;
}

// Keep our custom conversation type as it includes app-specific fields
export interface Conversation {
  id: string;
  title: string;
  messages: Message[]; // Use AI SDK Message type
  updatedAt: Date;
  model: string;
  mcpEnabled: boolean;
  isGeneratingTitle?: boolean;
  streamState?: StreamState;
}

export interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoaded: boolean;
}

// ===== STREAM TYPES =====
export interface StreamState {
  isStreaming: boolean;
  lastStreamedAt: Date;
  messageId?: string;
}

export interface StreamRecoveryData {
  hasActiveStream: boolean;
  session?: StreamSession;
  message?: Message; // Use AI SDK Message type
  canRecover: boolean;
  lastKnownPosition?: number;
  totalContent?: string;
}

export interface StreamSession {
  _id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  lastKnownPosition: number;
  totalContent: string;
  startedAt: number;
  lastActiveAt: number;
  completedAt?: number;
}

// ===== FILE TYPES =====
export interface AttachedFile {
  name: string;
  type: string;
  size: number;
  url?: string;
  content?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  url?: string;
  lastModified: number;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

// ===== MCP TYPES =====
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
    [key: string]: string | number | boolean;
  }>;
}

export interface MCPCapabilities {
  tools: Record<string, { description: string }>;
}

export interface MCPToolExecution {
  toolName: string;
  args: Record<string, unknown>;
  startTime: number;
}

// ===== SERVICE TYPES =====
export interface ServiceStats {
  initialized: boolean;
  initializationTime?: number;
  lastInitialized?: Date;
  serviceCount: number;
  vectorServiceEnabled: boolean;
}

// ===== EMBEDDINGS TYPES =====
export interface EmbeddingsStatus {
  hasEmbeddings: boolean;
  totalEmbeddings: number;
  lastUpdated: string | null;
  indexSize: string;
  configuration: {
    chunkSize: number;
    overlap: number;
    model: string;
  };
}

// ===== API TYPES =====
export interface ChatRequest {
  messages: Message[]; // Use AI SDK Message type
  model?: string;
  mcpEnabled?: boolean;
}

export interface MessageInput {
  role: string;
  content: string;
}
