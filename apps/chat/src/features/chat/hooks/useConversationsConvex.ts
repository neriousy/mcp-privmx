import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Conversation, ChatMessage, MessageMetadata } from '@/types';

interface ConvexConversationDoc {
  _id: Id<'conversations'>;
  title: string;
  model: string;
  mcpEnabled: boolean;
  updatedAt: number;
  hasActiveStream: boolean;
  messages?: Array<{
    _id: Id<'messages'>;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
    metadata?: MessageMetadata;
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
  metadata?: MessageMetadata;
}): ChatMessage => ({
  id: String(msg._id),
  role: msg.role,
  content: msg.content,
  createdAt: new Date(msg.createdAt),
  ...(msg.metadata && { metadata: msg.metadata }),
});

const convertConvexConversation = (
  doc: ConvexConversationDoc
): Conversation => ({
  id: String(doc._id),
  title: doc.title,
  model: doc.model,
  mcpEnabled: doc.mcpEnabled,
  updatedAt: new Date(doc.updatedAt),
  messages: (doc.messages || []).map(convertConvexMessage),
  streamState: doc.streamState
    ? {
        isStreaming: doc.hasActiveStream,
        lastStreamedAt: new Date(doc.streamState.lastActivity),
        messageId: doc.streamState.activeMessageId
          ? String(doc.streamState.activeMessageId)
          : undefined,
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
      const result = await createConv({ title, model, mcpEnabled });

      // Convert the result to our Conversation type
      const conversation = convertConvexConversation(result);
      setCurrentConversationId(conversation.id);

      return conversation;
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
    async (id: string) => {
      await deleteConv({
        conversationId: id as Id<'conversations'>,
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
