import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Message } from 'ai';

// Types
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
  model: string;
  mcpEnabled: boolean;
  isGeneratingTitle?: boolean; // Track title generation state
  streamState?: {
    isStreaming: boolean;
    lastStreamedAt: Date;
    messageId?: string;
  };
}

export interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoaded: boolean;
}

// LocalStorage utilities
const CONVERSATIONS_KEY = 'privmx-chat-conversations';
const CURRENT_CONVERSATION_KEY = 'privmx-current-conversation';

const loadConversations = (): Conversation[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(CONVERSATIONS_KEY);
  if (!stored) return [];
  try {
    const conversations = JSON.parse(stored);
    return conversations.map((conv: Conversation) => ({
      ...conv,
      updatedAt: new Date(conv.updatedAt),
      isGeneratingTitle: false, // Reset on load
      streamState: conv.streamState
        ? {
            ...conv.streamState,
            isStreaming: false, // Reset streaming state on page load
            lastStreamedAt: new Date(conv.streamState.lastStreamedAt),
          }
        : undefined,
    }));
  } catch (error) {
    console.error('Error loading conversations from localStorage:', error);
    return [];
  }
};

const saveConversations = (conversations: Conversation[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Error saving conversations to localStorage:', error);
  }
};

const loadCurrentConversationId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_CONVERSATION_KEY);
};

const saveCurrentConversationId = (id: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CURRENT_CONVERSATION_KEY, id);
  } catch (error) {
    console.error('Error saving current conversation ID:', error);
  }
};

// Improved title generation with better error handling
const generateConversationTitle = async (
  messages: Message[]
): Promise<string> => {
  // Need at least one user message and one assistant response
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  if (userMessages.length === 0 || assistantMessages.length === 0) {
    return 'New Chat';
  }

  // Don't generate title for very short conversations
  const totalLength = messages.reduce((acc, m) => acc + m.content.length, 0);
  if (totalLength < 20) {
    return 'New Chat';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: messages.slice(0, 4) }), // Only send first 4 messages
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const { title } = await response.json();
      if (title && title.trim() && title !== 'New Chat') {
        return title.trim();
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Failed to generate title:', error);
    }
  }

  // Fallback: Use first user message
  const firstUserMessage = userMessages[0];
  if (firstUserMessage) {
    const content = firstUserMessage.content.trim();
    if (content.length > 50) {
      return content.substring(0, 47) + '...';
    }
    return content;
  }

  return 'New Chat';
};

const createInitialConversation = (
  model: string,
  mcpEnabled: boolean
): Conversation => {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More unique ID
    title: 'New Chat',
    messages: [],
    updatedAt: new Date(),
    model,
    mcpEnabled,
    isGeneratingTitle: false,
  };
};

export function useConversations(
  initialModel: string,
  initialMcpEnabled: boolean
) {
  const [state, setState] = useState<ConversationState>(() => ({
    conversations: [],
    currentConversationId: null,
    isLoaded: false,
  }));

  // Track pending title generations to avoid duplicates
  const pendingTitleGenerations = useRef<Set<string>>(new Set());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save function
  const debouncedSave = useCallback((conversations: Conversation[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveConversations(conversations);
    }, 300); // 300ms debounce
  }, []);

  // Load from localStorage after component mounts
  useEffect(() => {
    const savedConversations = loadConversations();
    const savedCurrentId = loadCurrentConversationId();

    if (savedConversations.length === 0) {
      const newConversation = createInitialConversation(
        initialModel,
        initialMcpEnabled
      );
      const conversations = [newConversation];
      setState({
        conversations,
        currentConversationId: newConversation.id,
        isLoaded: true,
      });
      saveConversations(conversations);
      saveCurrentConversationId(newConversation.id);
    } else {
      const currentId = savedCurrentId || savedConversations[0].id;
      setState({
        conversations: savedConversations,
        currentConversationId: currentId,
        isLoaded: true,
      });
    }
  }, [initialModel, initialMcpEnabled]);

  const { conversations, currentConversationId, isLoaded } = state;

  // Derived state
  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId) || null,
    [conversations, currentConversationId]
  );

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [conversations]
  );

  // Generate title for conversation (separate function to avoid recursion)
  const generateTitle = useCallback(
    async (conversationId: string, messages: Message[]) => {
      // Prevent duplicate title generations
      if (pendingTitleGenerations.current.has(conversationId)) {
        return;
      }

      pendingTitleGenerations.current.add(conversationId);

      try {
        // Mark as generating title
        setState((prev) => ({
          ...prev,
          conversations: prev.conversations.map((conv) =>
            conv.id === conversationId
              ? { ...conv, isGeneratingTitle: true }
              : conv
          ),
        }));

        const newTitle = await generateConversationTitle(messages);

        if (newTitle && newTitle !== 'New Chat') {
          setState((prev) => {
            const updatedConversations = prev.conversations.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    title: newTitle,
                    isGeneratingTitle: false,
                    updatedAt: new Date(),
                  }
                : conv
            );
            debouncedSave(updatedConversations);
            return {
              ...prev,
              conversations: updatedConversations,
            };
          });
        } else {
          // Just remove generating flag if no title was generated
          setState((prev) => ({
            ...prev,
            conversations: prev.conversations.map((conv) =>
              conv.id === conversationId
                ? { ...conv, isGeneratingTitle: false }
                : conv
            ),
          }));
        }
      } catch (error) {
        console.error('Error generating title:', error);
        setState((prev) => ({
          ...prev,
          conversations: prev.conversations.map((conv) =>
            conv.id === conversationId
              ? { ...conv, isGeneratingTitle: false }
              : conv
          ),
        }));
      } finally {
        pendingTitleGenerations.current.delete(conversationId);
      }
    },
    [debouncedSave]
  );

  const createNewConversation = useCallback(
    (model: string, mcpEnabled: boolean) => {
      const newConversation = createInitialConversation(model, mcpEnabled);

      setState((prev) => {
        const updatedConversations = [newConversation, ...prev.conversations];
        saveConversations(updatedConversations);
        saveCurrentConversationId(newConversation.id);

        return {
          ...prev,
          conversations: updatedConversations,
          currentConversationId: newConversation.id,
        };
      });

      return newConversation;
    },
    []
  );

  const switchToConversation = useCallback((conversationId: string) => {
    setState((prev) => ({
      ...prev,
      currentConversationId: conversationId,
    }));
    saveCurrentConversationId(conversationId);
  }, []);

  const updateConversation = useCallback(
    (conversationId: string, updates: Partial<Omit<Conversation, 'id'>>) => {
      setState((prev) => {
        const updatedConversations = prev.conversations.map((conv) => {
          if (conv.id === conversationId) {
            const updatedConv = {
              ...conv,
              ...updates,
              updatedAt: new Date(),
            };
            return updatedConv;
          }
          return conv;
        });

        debouncedSave(updatedConversations);

        return {
          ...prev,
          conversations: updatedConversations,
        };
      });

      // Handle title generation separately and asynchronously
      if (updates.messages) {
        const conversation = conversations.find((c) => c.id === conversationId);
        if (
          conversation &&
          conversation.title === 'New Chat' &&
          !conversation.isGeneratingTitle &&
          updates.messages.length >= 2
        ) {
          // Check if we have at least one user message and one assistant message
          const userMessages = updates.messages.filter(
            (m) => m.role === 'user'
          );
          const assistantMessages = updates.messages.filter(
            (m) => m.role === 'assistant'
          );

          if (userMessages.length >= 1 && assistantMessages.length >= 1) {
            // Generate title asynchronously without blocking
            generateTitle(conversationId, updates.messages);
          }
        }
      }
    },
    [conversations, debouncedSave, generateTitle]
  );

  const deleteConversation = useCallback((conversationId: string) => {
    setState((prev) => {
      const updatedConversations = prev.conversations.filter(
        (c) => c.id !== conversationId
      );

      let newCurrentId = prev.currentConversationId;
      if (prev.currentConversationId === conversationId) {
        newCurrentId =
          updatedConversations.length > 0 ? updatedConversations[0].id : null;
      }

      // Save immediately for deletions
      saveConversations(updatedConversations);

      if (newCurrentId) {
        saveCurrentConversationId(newCurrentId);
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CURRENT_CONVERSATION_KEY);
        }
      }

      return {
        ...prev,
        conversations: updatedConversations,
        currentConversationId: newCurrentId,
      };
    });
  }, []);

  // Update stream state for a conversation
  const updateStreamState = useCallback(
    (conversationId: string, streamState: Conversation['streamState']) => {
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((conv) =>
          conv.id === conversationId
            ? { ...conv, streamState, updatedAt: new Date() }
            : conv
        ),
      }));
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    conversations,
    currentConversation,
    currentConversationId,
    sortedConversations,
    isLoaded,

    // Actions
    createNewConversation,
    switchToConversation,
    updateConversation,
    deleteConversation,
    updateStreamState,

    // Utilities
    generateTitle: (conversationId: string, messages: Message[]) =>
      generateTitle(conversationId, messages),
  };
}
