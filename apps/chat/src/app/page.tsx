'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { motion, AnimatePresence } from 'motion/react';
import { useConversations } from '../hooks/useConversations';
import { ChatSidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { ChatInput } from '../components/ChatInput';

// Type definitions
export interface AttachedFile {
  name: string;
  type: string;
  size: number;
  url?: string;
  content?: string;
}

interface MessageAttachment {
  name: string;
  contentType: string;
  url: string;
}

interface MessageObject {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  experimental_attachments?: MessageAttachment[];
}

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
    isLoaded,
  } = useConversations(selectedModel, mcpConnected);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: _handleSubmit,
    status,
    setMessages,
    append,
  } = useChat({
    api: '/api/chat',
    initialMessages: currentConversation?.messages || [],
    body: {
      model: selectedModel,
      mcpEnabled: mcpConnected,
    },
    onFinish: (message) => {
      // Update conversation with all current messages (including both user and assistant)
      if (currentConversationId) {
        updateConversation(currentConversationId, {
          messages: [...messages, message],
          model: selectedModel,
          mcpEnabled: mcpConnected,
        });
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Still save messages even if there's an error
      if (currentConversationId) {
        updateConversation(currentConversationId, {
          messages: messages,
          model: selectedModel,
          mcpEnabled: mcpConnected,
        });
      }
    },
  });

  // Check if this is the first message (only welcome message exists)
  const isFirstMessage =
    currentConversation &&
    currentConversation.messages.length <= 1 &&
    currentConversation.messages[0]?.role === 'assistant' &&
    currentConversation.messages[0]?.id === 'welcome';

  const hasUserMessages = messages.some((m) => m.role === 'user');

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

  const handleSubmitWithSave = async (
    e: React.FormEvent,
    attachedFiles?: AttachedFile[]
  ) => {
    e.preventDefault();

    // Create the message content
    let messageContent = input.trim();
    const messageAttachments: MessageAttachment[] = [];

    // If there are attached files, process them
    if (attachedFiles && attachedFiles.length > 0) {
      // Separate images from other files
      const imageFiles = attachedFiles.filter(
        (file) => file.type.startsWith('image/') && file.url
      );
      const nonImageFiles = attachedFiles.filter(
        (file) => !file.type.startsWith('image/') || !file.url
      );

      // For images, add them as attachments for vision models
      if (imageFiles.length > 0) {
        imageFiles.forEach((file) => {
          if (file.url) {
            messageAttachments.push({
              name: file.name,
              contentType: file.type,
              url: file.url,
            });
          }
        });
      }

      // For non-image files, include their information in text
      if (nonImageFiles.length > 0) {
        const fileInfo = nonImageFiles
          .map(
            (file) =>
              `File: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`
          )
          .join('\n');

        // For text files, include their content
        const textFiles = nonImageFiles.filter((file) => file.content);
        const fileContents = textFiles
          .map(
            (file) =>
              `\n--- ${file.name} ---\n${file.content}\n--- End of ${file.name} ---\n`
          )
          .join('\n');

        // Enhance the message content
        messageContent =
          messageContent +
          (fileInfo ? `\n\nAttached files:\n${fileInfo}` : '') +
          (fileContents ? `\n\nFile contents:${fileContents}` : '');
      }

      // If there are only images and no text, add a default message
      if (
        imageFiles.length > 0 &&
        !messageContent &&
        nonImageFiles.length === 0
      ) {
        messageContent = `Please analyze this image${imageFiles.length > 1 ? 's' : ''}.`;
      }
    }

    // Only proceed if we have content to send
    if (!messageContent && messageAttachments.length === 0) {
      return;
    }

    try {
      // Create message object with proper format for vision models
      const messageObject: MessageObject = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: messageContent,
      };

      // Add attachments for images using the new experimental format
      if (messageAttachments.length > 0) {
        messageObject.experimental_attachments = messageAttachments;
      }

      // Clear the input immediately for better UX
      handleInputChange({
        target: { value: '' },
      } as React.ChangeEvent<HTMLInputElement>);

      // Use the append function to add the message
      await append(messageObject);

      // Save the user message immediately
      if (currentConversationId) {
        updateConversation(currentConversationId, {
          messages: [...messages, messageObject],
          model: selectedModel,
          mcpEnabled: mcpConnected,
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Don't render until conversations are loaded to prevent hydration issues
  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full bg-background items-center justify-center">
        <div className="text-foreground/60">Loading...</div>
      </div>
    );
  }

  // Check if this should show centered layout - either no conversation, or empty conversation with no user messages
  const showCenteredLayout =
    !currentConversationId ||
    (currentConversation &&
      currentConversation.messages.length === 0 &&
      !hasUserMessages) ||
    (isFirstMessage && !hasUserMessages);

  return (
    <div className="flex h-screen w-full bg-background">
      <ChatSidebar
        conversations={sortedConversations}
        currentConversationId={currentConversationId}
        onCreateNewConversation={handleCreateNewConversation}
        onSwitchConversation={handleSwitchConversation}
        onDeleteConversation={deleteConversation}
      />

      <div className="flex flex-col flex-1 bg-background relative">
        <AnimatePresence mode="wait">
          {showCenteredLayout ? (
            // Centered welcome layout
            <motion.div
              key="welcome"
              className="flex flex-col items-center justify-center h-full p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <motion.div
                className="text-center max-w-2xl mb-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
              >
                <h1 className="text-3xl font-semibold text-foreground mb-4">
                  How can I help you?
                </h1>
                <p className="text-muted-foreground text-lg">
                  I&apos;m here to help you with PrivMX development. Ask me
                  anything about code generation, APIs, architecture, or best
                  practices.
                </p>
              </motion.div>

              <motion.div
                className="w-full max-w-4xl"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
                layout
              >
                <ChatInput
                  input={input}
                  isLoading={status === 'streaming'}
                  selectedModel={selectedModel}
                  mcpConnected={mcpConnected}
                  onInputChange={handleInputChange}
                  onSubmit={handleSubmitWithSave}
                  onModelChange={handleModelChange}
                  onMcpToggle={handleMcpToggle}
                />
              </motion.div>
            </motion.div>
          ) : (
            // Chat layout
            <motion.div
              key="chat"
              className="flex flex-col h-full min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <motion.div
                className="flex-1 h-full overflow-hidden"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
              >
                <ChatArea
                  messages={messages}
                  isLoading={status === 'streaming'}
                />
              </motion.div>

              <motion.div
                className="sticky bottom-0 align-center  border-radius-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
                layout
              >
                <ChatInput
                  input={input}
                  isLoading={status === 'streaming'}
                  selectedModel={selectedModel}
                  mcpConnected={mcpConnected}
                  onInputChange={handleInputChange}
                  onSubmit={handleSubmitWithSave}
                  onModelChange={handleModelChange}
                  onMcpToggle={handleMcpToggle}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
