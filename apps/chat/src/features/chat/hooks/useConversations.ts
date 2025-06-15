import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useConversationsConvex } from './useConversationsConvex';
import { useConversationsLocal } from './useConversationsLocal';

export function useConversations() {
  const { isLoaded: authLoaded, isSignedIn } = useAuthStatus();

  // Call both hooks unconditionally to comply with React hook rules
  const convexApi = useConversationsConvex();
  const localApi = useConversationsLocal();

  if (!authLoaded) {
    // Return loading stub with isLoaded false
    return {
      conversations: [],
      currentConversation: null,
      currentConversationId: null,
      sortedConversations: [],
      isLoaded: false,
      createConversation: async () => {
        throw new Error('Auth not loaded');
      },
      switchConversation: () => {},
      updateConversation: async () => {},
      deleteConversation: async () => {},
    } as typeof convexApi;
  }

  return isSignedIn ? convexApi : localApi;
}
