import { useCallback, useEffect, useMemo, useState } from 'react';
import { Conversation } from '@/types';
import { Message } from '@/types';

const LS_KEY = 'privmx-local-conversations';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return parsed.map((c) => ({ ...c, updatedAt: new Date(c.updatedAt) }));
  } catch (err) {
    console.warn('[useConversationsLocal] localStorage error', err);
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(convs));
  } catch {}
}

export function useConversationsLocal() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations()
  );
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(conversations[0]?.id || null);

  // persist
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }, [conversations]);

  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId) || null,
    [conversations, currentConversationId]
  );

  const createConversation = useCallback(
    async (model: string, mcpEnabled: boolean) => {
      const newConv: Conversation = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        messages: [],
        updatedAt: new Date(),
        model,
        mcpEnabled,
      };
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConversationId(newConv.id);
      return newConv;
    },
    []
  );

  const switchConversation = useCallback(
    (id: string | null) => setCurrentConversationId(id),
    []
  );

  const updateConversation = useCallback(
    async (
      id: string,
      updates: Partial<Conversation> & { messages?: Message[] }
    ) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
        )
      );
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) setCurrentConversationId(null);
    },
    [currentConversationId]
  );

  return {
    conversations,
    currentConversation,
    currentConversationId,
    sortedConversations,
    isLoaded: true,
    createConversation,
    switchConversation,
    updateConversation,
    deleteConversation,
  };
}
