import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Message, Conversation, StreamState } from '@/types';
import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface ConversationUpdates {
  messages?: Message[];
  title?: string;
  model?: string;
  mcpEnabled?: boolean;
  streamState?: StreamState;
}

// Store state interface
interface ConversationState {
  // Data
  conversations: Conversation[];
  currentConversationId: string | null;

  // UI State
  isLoaded: boolean;
  isAuthenticated: boolean;
  isConvexMode: boolean;

  // Settings
  defaultModel: string;
  defaultMcpEnabled: boolean;
}

// Store actions interface
interface ConversationActions {
  // State setters
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setAuthState: (isAuthenticated: boolean, isConvexMode: boolean) => void;
  setLoaded: (isLoaded: boolean) => void;
  setDefaults: (model: string, mcpEnabled: boolean) => void;

  // Conversation operations
  createConversation: (model?: string, mcpEnabled?: boolean) => Conversation;
  switchToConversation: (id: string) => void;
  updateConversationLocal: (id: string, updates: Partial<Conversation>) => void;
  deleteConversationLocal: (id: string) => void;

  // Utilities
  reset: () => void;
  findConversation: (id: string) => Conversation | undefined;
}

// Combined store type
type ConversationStore = ConversationState & ConversationActions;

// =============================================================================
// UTILITIES
// =============================================================================

const createInitialConversation = (
  model: string,
  mcpEnabled: boolean
): Conversation => ({
  id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: 'New Chat',
  messages: [],
  updatedAt: new Date(),
  model,
  mcpEnabled,
  isGeneratingTitle: false,
});

// =============================================================================
// STORE
// =============================================================================

export const useConversationStore = create<ConversationStore>()(
  devtools(
    (set, get) => ({
      // =============================================================================
      // INITIAL STATE
      // =============================================================================
      conversations: [],
      currentConversationId: null,
      isLoaded: false,
      isAuthenticated: false,
      isConvexMode: false,
      defaultModel: 'gpt-4o',
      defaultMcpEnabled: false,

      // =============================================================================
      // STATE SETTERS
      // =============================================================================
      setConversations: (conversations) =>
        set({ conversations }, false, 'setConversations'),

      setCurrentConversationId: (id) =>
        set({ currentConversationId: id }, false, 'setCurrentConversationId'),

      setAuthState: (isAuthenticated, isConvexMode) =>
        set({ isAuthenticated, isConvexMode }, false, 'setAuthState'),

      setLoaded: (isLoaded) => set({ isLoaded }, false, 'setLoaded'),

      setDefaults: (model, mcpEnabled) =>
        set(
          { defaultModel: model, defaultMcpEnabled: mcpEnabled },
          false,
          'setDefaults'
        ),

      // =============================================================================
      // CONVERSATION OPERATIONS
      // =============================================================================
      createConversation: (model, mcpEnabled) => {
        const { defaultModel, defaultMcpEnabled, conversations } = get();
        const newConversation = createInitialConversation(
          model || defaultModel,
          mcpEnabled ?? defaultMcpEnabled
        );

        const updatedConversations = [newConversation, ...conversations];

        set(
          {
            conversations: updatedConversations,
            currentConversationId: newConversation.id,
          },
          false,
          'createConversation'
        );

        return newConversation;
      },

      switchToConversation: (id) => {
        const { conversations } = get();
        const conversation = conversations.find((c) => c.id === id);

        if (conversation) {
          set({ currentConversationId: id }, false, 'switchToConversation');
        } else {
          console.warn(`Conversation with id ${id} not found`);
        }
      },

      updateConversationLocal: (id, updates) => {
        const { conversations } = get();
        const updatedConversations = conversations.map((conv) => {
          if (conv.id === id) {
            return {
              ...conv,
              ...updates,
              updatedAt: new Date(),
            };
          }
          return conv;
        });

        set(
          { conversations: updatedConversations },
          false,
          'updateConversationLocal'
        );
      },

      deleteConversationLocal: (id) => {
        const { conversations, currentConversationId } = get();
        const updatedConversations = conversations.filter((c) => c.id !== id);

        let newCurrentId = currentConversationId;
        if (currentConversationId === id) {
          newCurrentId =
            updatedConversations.length > 0 ? updatedConversations[0].id : null;
        }

        set(
          {
            conversations: updatedConversations,
            currentConversationId: newCurrentId,
          },
          false,
          'deleteConversationLocal'
        );
      },

      // =============================================================================
      // UTILITIES
      // =============================================================================
      findConversation: (id) => {
        const { conversations } = get();
        return conversations.find((c) => c.id === id);
      },

      reset: () =>
        set(
          {
            conversations: [],
            currentConversationId: null,
            isLoaded: false,
            isAuthenticated: false,
            isConvexMode: false,
          },
          false,
          'reset'
        ),
    }),
    {
      name: 'conversation-store',
      // Only serialize essential state for debugging
      partialize: (state: ConversationStore) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
        isConvexMode: state.isConvexMode,
      }),
    }
  )
);

// =============================================================================
// SELECTORS
// =============================================================================

// Convenience selectors for common use cases
export const useCurrentConversation = () => {
  const conversations = useConversationStore((state) => state.conversations);
  const currentConversationId = useConversationStore(
    (state) => state.currentConversationId
  );

  return useMemo(() => {
    if (!currentConversationId) return null;
    return conversations.find((c) => c.id === currentConversationId) || null;
  }, [conversations, currentConversationId]);
};

export const useSortedConversations = () => {
  const conversations = useConversationStore((state) => state.conversations);

  return useMemo(
    () =>
      [...conversations].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [conversations]
  );
};

export const useConversationActions = () => {
  const createConversation = useConversationStore((s) => s.createConversation);
  const switchToConversation = useConversationStore(
    (s) => s.switchToConversation
  );
  const updateConversationLocal = useConversationStore(
    (s) => s.updateConversationLocal
  );
  const deleteConversationLocal = useConversationStore(
    (s) => s.deleteConversationLocal
  );
  const setCurrentConversationId = useConversationStore(
    (s) => s.setCurrentConversationId
  );

  return useMemo(
    () => ({
      createConversation,
      switchToConversation,
      updateConversationLocal,
      deleteConversationLocal,
      setCurrentConversationId,
    }),
    [
      createConversation,
      switchToConversation,
      updateConversationLocal,
      deleteConversationLocal,
      setCurrentConversationId,
    ]
  );
};

export const useConversationState = () => {
  const conversations = useConversationStore((s) => s.conversations);
  const currentConversationId = useConversationStore(
    (s) => s.currentConversationId
  );
  const isLoaded = useConversationStore((s) => s.isLoaded);
  const isAuthenticated = useConversationStore((s) => s.isAuthenticated);
  const isConvexMode = useConversationStore((s) => s.isConvexMode);

  return useMemo(
    () => ({
      conversations,
      currentConversationId,
      isLoaded,
      isAuthenticated,
      isConvexMode,
    }),
    [
      conversations,
      currentConversationId,
      isLoaded,
      isAuthenticated,
      isConvexMode,
    ]
  );
};
