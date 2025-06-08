import { useState, useCallback, useMemo } from 'react';
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
    return conversations.map((conv: any) => ({
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
  const initialMessages: Message[] = [
    {
      id: 'welcome',
      role: 'assistant',
      content: `# Welcome to PrivMX AI Assistant! 🚀

I'm here to help you with PrivMX development. I can assist with:

• **Code Generation** - Generate PrivMX code in multiple languages
• **API Discovery** - Find and understand PrivMX APIs  
• **Architecture Design** - Build secure applications
• **Best Practices** - Security and implementation guidance

What would you like to build today?`,
    },
  ];

  return {
    id: Date.now().toString(),
    title: 'New Chat',
    messages: initialMessages,
    updatedAt: new Date(),
    model,
    mcpEnabled,
  };
};

export function useConversations(
  initialModel: string,
  initialMcpEnabled: boolean
) {
  // Initialize state with localStorage data or create first conversation
  const [state, setState] = useState(() => {
    const savedConversations = loadConversations();
    const savedCurrentId = loadCurrentConversationId();

    if (savedConversations.length === 0) {
      const newConversation = createInitialConversation(
        initialModel,
        initialMcpEnabled
      );
      saveConversations([newConversation]);
      saveCurrentConversationId(newConversation.id);
      return {
        conversations: [newConversation],
        currentConversationId: newConversation.id,
      };
    }

    const currentId = savedCurrentId || savedConversations[0].id;
    return {
      conversations: savedConversations,
      currentConversationId: currentId,
    };
  });

  const { conversations, currentConversationId } = state;

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

      setState({
        conversations: updatedConversations,
        currentConversationId: newConversation.id,
      });

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

      if (updatedConversations.length === 0) {
        // If no conversations left, create a new one
        const newConversation = createInitialConversation('gpt-4o', false);
        saveConversations([newConversation]);
        saveCurrentConversationId(newConversation.id);
        return {
          conversations: [newConversation],
          currentConversationId: newConversation.id,
        };
      }

      saveConversations(updatedConversations);

      let newCurrentId = prev.currentConversationId;
      if (prev.currentConversationId === conversationId) {
        // Switch to the first conversation if we deleted the current one
        newCurrentId = updatedConversations[0].id;
        saveCurrentConversationId(newCurrentId);
      }

      return {
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
  };
}
