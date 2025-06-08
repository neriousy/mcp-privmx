'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { useConversations } from '../hooks/useConversations';
import { ChatSidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { ChatInput } from '../components/ChatInput';

export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [mcpConnected, setMcpConnected] = useState(false);

  const {
    currentConversation,
    currentConversationId,
    sortedConversations,
    createNewConversation,
    switchToConversation,
    updateConversation,
    deleteConversation,
  } = useConversations(selectedModel, mcpConnected);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
  } = useChat({
    api: '/api/chat',
    initialMessages: currentConversation?.messages || [],
    body: {
      model: selectedModel,
      mcpEnabled: mcpConnected,
    },
    onFinish: (message) => {
      // Update conversation when chat finishes
      if (currentConversationId) {
        updateConversation(currentConversationId, {
          messages: [...messages, message],
          model: selectedModel,
          mcpEnabled: mcpConnected,
        });
      }
    },
  });

  const handleCreateNewConversation = () => {
    const newConv = createNewConversation(selectedModel, mcpConnected);
    setMessages(newConv.messages);
  };

  const handleSwitchConversation = (conversationId: string) => {
    switchToConversation(conversationId);
    const conversation = sortedConversations.find(
      (c) => c.id === conversationId
    );
    if (conversation) {
      setMessages(conversation.messages);
      setSelectedModel(conversation.model);
      setMcpConnected(conversation.mcpEnabled);
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    // Update current conversation with new model
    if (currentConversationId) {
      updateConversation(currentConversationId, { model });
    }
  };

  const handleMcpToggle = () => {
    const newMcpState = !mcpConnected;
    setMcpConnected(newMcpState);
    // Update current conversation with new MCP state
    if (currentConversationId) {
      updateConversation(currentConversationId, { mcpEnabled: newMcpState });
    }
  };

  return (
    <div className="flex h-screen w-full bg-background">
      <ChatSidebar
        conversations={sortedConversations}
        currentConversationId={currentConversationId}
        onCreateNewConversation={handleCreateNewConversation}
        onSwitchConversation={handleSwitchConversation}
        onDeleteConversation={deleteConversation}
      />

      <div className="flex flex-col flex-1 bg-background">
        <ChatArea messages={messages} isLoading={status === 'streaming'} />
        <ChatInput
          input={input}
          isLoading={status === 'streaming'}
          selectedModel={selectedModel}
          mcpConnected={mcpConnected}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          onModelChange={handleModelChange}
          onMcpToggle={handleMcpToggle}
        />
      </div>
    </div>
  );
}
