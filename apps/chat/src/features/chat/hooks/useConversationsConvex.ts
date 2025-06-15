import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Message as AiMessage } from 'ai';
import { Conversation } from '@/types';

// Define the shape of metadata from the backend
interface BackendMessageMetadata {
  toolCalls?: Array<{
    toolName: string;
    args: any;
    result?: any;
    timestamp: number;
  }>;
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
  };
  attachments?: Array<{
    name: string;
    contentType: string;
    url: string;
  }>;
}

// Extend the AI Message type with our metadata
type Message = AiMessage & {
  metadata?: BackendMessageMetadata;
};

interface ConvexConversationDoc {
  _id: Id<'conversations'>;
  title: string;
  model: string;
  mcpEnabled: boolean;
  updatedAt: number;
  hasActiveStream: boolean;
  messages: Array<{
    _id: Id<'messages'>;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
    metadata?: BackendMessageMetadata;
  }>;
  streamState?: {
    activeMessageId?: Id<'messages'>;
    streamStartedAt?: number;
    lastActivity: number;
  };
}

const convertConvexMessage = (msg: {
  _id: Id<'messages'>;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  metadata?: BackendMessageMetadata;
}): Message => ({
  id: msg._id,
  role: msg.role,
  content: msg.content,
  createdAt: new Date(msg.createdAt),
  ...(msg.metadata && { metadata: msg.metadata }),
});

const convertConvexConversation = (
  doc: ConvexConversationDoc
): Conversation => ({
  id: doc._id,
  title: doc.title,
  model: doc.model,
  mcpEnabled: doc.mcpEnabled,
  updatedAt: new Date(doc.updatedAt),
  messages: doc.messages.map(convertConvexMessage),
  streamState: doc.streamState
    ? {
        isStreaming: doc.hasActiveStream,
        lastStreamedAt: new Date(doc.streamState.lastActivity),
        messageId: doc.streamState.activeMessageId,
      }
    : undefined,
});

export interface UseConversationsReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  currentConversationId: Id<'conversations'> | null;
  sortedConversations: Conversation[];
  isLoaded: boolean;

  createConversation: (
    model: string,
    mcpEnabled: boolean
  ) => Promise<Conversation>;
  switchConversation: (id: Id<'conversations'> | null) => void;
  updateConversation: (
    id: Id<'conversations'>,
    updates: Partial<Pick<Conversation, 'title' | 'model' | 'mcpEnabled'>>
  ) => Promise<void>;
  deleteConversation: (id: Id<'conversations'>) => Promise<void>;
}

export function useConversationsConvex(): UseConversationsReturn {
  const convexConvs = useQuery(api.conversations.list, {});
  const createConv = useMutation(api.conversations.create);
  const updateConv = useMutation(api.conversations.update);
  const deleteConv = useMutation(api.conversations.remove);

  const [currentConversationId, setCurrentConversationId] =
    useState<Id<'conversations'> | null>(null);

  const conversations = useMemo<Conversation[]>(() => {
    return convexConvs ? convexConvs.map(convertConvexConversation) : [];
  }, [convexConvs]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }, [conversations]);

  const currentConversation = useMemo(() => {
    return currentConversationId
      ? conversations.find((c) => c.id === currentConversationId) || null
      : null;
  }, [conversations, currentConversationId]);

  const isLoaded = convexConvs !== undefined;

  const createConversation = useCallback(
    async (model: string, mcpEnabled: boolean) => {
      const title = 'New Chat';
      const id = await createConv({ title, model, mcpEnabled });
      setCurrentConversationId(id);
      return {
        id,
        title,
        model,
        mcpEnabled,
        updatedAt: new Date(),
        messages: [],
      } as Conversation;
    },
    [createConv]
  );

  const switchConversation = useCallback((id: Id<'conversations'> | null) => {
    setCurrentConversationId(id);
  }, []);

  const updateConversation = useCallback(
    async (
      id: Id<'conversations'>,
      updates: Partial<Pick<Conversation, 'title' | 'model' | 'mcpEnabled'>>
    ) => {
      await updateConv({
        conversationId: id as Id<'conversations'>,
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.model !== undefined && { model: updates.model }),
        ...(updates.mcpEnabled !== undefined && {
          mcpEnabled: updates.mcpEnabled,
        }),
      });
    },
    [updateConv]
  );

  const deleteConversation = useCallback(
    async (id: Id<'conversations'>) => {
      await deleteConv({
        conversationId: id,
      });
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [deleteConv, currentConversationId]
  );

  return {
    conversations,
    currentConversation,
    currentConversationId,
    sortedConversations,
    isLoaded,
    createConversation,
    switchConversation,
    updateConversation,
    deleteConversation,
  };
}
