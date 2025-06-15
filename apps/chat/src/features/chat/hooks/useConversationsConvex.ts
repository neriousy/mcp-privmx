import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Message } from 'ai';
import { Conversation } from '@/types';

interface ConvexConversationDoc {
  _id: Id<'conversations'>;
  title: string;
  model: string;
  mcpEnabled: boolean;
  updatedAt: number;
  messages: Array<{
    _id: Id<'messages'>;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
    metadata?: unknown;
  }>;
  streamState?: {
    hasActiveStream: boolean;
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
}): Message => ({
  id: msg._id,
  role: msg.role,
  content: msg.content,
  createdAt: new Date(msg.createdAt),
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
        isStreaming: doc.streamState.hasActiveStream,
        lastStreamedAt: new Date(doc.streamState.lastActivity),
        messageId: doc.streamState.activeMessageId,
      }
    : undefined,
});

export interface UseConversationsReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  currentConversationId: string | null;
  sortedConversations: Conversation[];
  isLoaded: boolean;

  createConversation: (
    model: string,
    mcpEnabled: boolean
  ) => Promise<Conversation>;
  switchConversation: (id: string | null) => void;
  updateConversation: (
    id: string,
    updates: Partial<Pick<Conversation, 'title' | 'model' | 'mcpEnabled'>>
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

export function useConversationsConvex(): UseConversationsReturn {
  const convexConvs = useQuery(api.conversations.list, {});
  const createConv = useMutation(api.conversations.create);
  const updateConv = useMutation(api.conversations.update);
  const deleteConv = useMutation(api.conversations.remove);

  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);

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
      const idStr = id as unknown as string;
      setCurrentConversationId(idStr);
      return {
        id: idStr,
        title,
        model,
        mcpEnabled,
        updatedAt: new Date(),
        messages: [],
      } as Conversation;
    },
    [createConv]
  );

  const switchConversation = useCallback((id: string | null) => {
    setCurrentConversationId(id);
  }, []);

  const updateConversation = useCallback(
    async (
      id: string,
      updates: Partial<Pick<Conversation, 'title' | 'model' | 'mcpEnabled'>>
    ) => {
      await updateConv({
        conversationId: id as unknown as Id<'conversations'>,
        ...updates,
      });
    },
    [updateConv]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await deleteConv({
        conversationId: id as unknown as Id<'conversations'>,
      });
      if (currentConversationId === id) setCurrentConversationId(null);
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
