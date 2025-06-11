import { useState, useCallback, useMemo, useEffect } from 'react';
import { Message } from 'ai';

// Types
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
  model: string;
  mcpEnabled: boolean;
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
    }));
  } catch {
    return [];
  }
};

const saveConversations = (conversations: Conversation[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
};

const loadCurrentConversationId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_CONVERSATION_KEY);
};

const saveCurrentConversationId = (id: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_CONVERSATION_KEY, id);
};

const generateConversationTitle = async (
  messages: Message[]
): Promise<string> => {
  // Only generate AI title if we have some meaningful conversation
  if (messages.length < 2) {
    return 'New Chat';
  }

  try {
    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (response.ok) {
      const { title } = await response.json();
      return title;
    }
  } catch (error) {
    console.error('Failed to generate title:', error);
  }

  // Fallback to old method
  const firstUserMessage = messages.find((m) => m.role === 'user');
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
    id: Date.now().toString(),
    title: 'New Chat',
    messages: [],
    updatedAt: new Date(),
    model,
    mcpEnabled,
  };
};

export function useConversations(
  initialModel: string,
  initialMcpEnabled: boolean
) {
  // Initialize with empty state first to avoid hydration issues
  const [state, setState] = useState(() => ({
    conversations: [] as Conversation[],
    currentConversationId: null as string | null,
    isLoaded: false,
  }));

  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    const savedConversations = loadConversations();
    const savedCurrentId = loadCurrentConversationId();

    if (savedConversations.length === 0) {
      const newConversation = createInitialConversation(
        initialModel,
        initialMcpEnabled
      );
      saveConversations([newConversation]);
      saveCurrentConversationId(newConversation.id);
      setState({
        conversations: [newConversation],
        currentConversationId: newConversation.id,
        isLoaded: true,
      });
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
    () => conversations.find((c) => c.id === currentConversationId),
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

  const createNewConversation = useCallback(
    (model: string, mcpEnabled: boolean) => {
      const newConversation = createInitialConversation(model, mcpEnabled);
      const updatedConversations = [newConversation, ...conversations];

      setState((prev) => ({
        ...prev,
        conversations: updatedConversations,
        currentConversationId: newConversation.id,
      }));

      saveConversations(updatedConversations);
      saveCurrentConversationId(newConversation.id);

      return newConversation;
    },
    [conversations]
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

            // Auto-generate title if it's still "New Chat" and we have messages
            if (conv.title === 'New Chat' && updates.messages) {
              // Generate title asynchronously
              generateConversationTitle(updates.messages).then((newTitle) => {
                if (newTitle !== 'New Chat') {
                  updateConversation(conversationId, { title: newTitle });
                }
              });
            }

            return updatedConv;
          }
          return conv;
        });

        saveConversations(updatedConversations);

        return {
          ...prev,
          conversations: updatedConversations,
        };
      });
    },
    []
  );

  const deleteConversation = useCallback((conversationId: string) => {
    setState((prev) => {
      const updatedConversations = prev.conversations.filter(
        (c) => c.id !== conversationId
      );

      // Save the updated conversations (even if empty)
      saveConversations(updatedConversations);

      let newCurrentId = prev.currentConversationId;
      if (prev.currentConversationId === conversationId) {
        // If we deleted the current conversation, switch to the first remaining one
        // Or set to null if no conversations left
        newCurrentId =
          updatedConversations.length > 0 ? updatedConversations[0].id : null;
        if (newCurrentId) {
          saveCurrentConversationId(newCurrentId);
        } else {
          // Clear current conversation from localStorage when no conversations left
          if (typeof window !== 'undefined') {
            localStorage.removeItem(CURRENT_CONVERSATION_KEY);
          }
        }
      }

      return {
        ...prev,
        conversations: updatedConversations,
        currentConversationId: newCurrentId,
      };
    });
  }, []);

  return {
    conversations,
    currentConversation,
    currentConversationId,
    sortedConversations,
    createNewConversation,
    switchToConversation,
    updateConversation,
    deleteConversation,
    isLoaded,
  };
}
