'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat, Message } from '@ai-sdk/react';
import { motion, AnimatePresence } from 'motion/react';

import { ChatSidebar } from '../components/layout/Sidebar';
import { ChatArea } from '../features/chat/components/ChatArea';
import { ChatInput } from '../features/chat/components/ChatInput';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useConversations } from '@/features/chat/hooks/useConversations';
import { useAuthStatus } from '@/hooks/useAuthStatus';

// =============================================================================
// TYPES
// =============================================================================

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

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [mcpConnected, setMcpConnected] = useState(false);

  // Conversations handled via Convex
  const {
    currentConversation,
    sortedConversations,
    currentConversationId,
    isLoaded,
    createConversation,
    switchConversation,
    deleteConversation,
    updateConversation,
  } = useConversations();

  // Keep latest conversation id for async handlers
  const conversationIdRef = useRef<string | null>(currentConversationId);
  useEffect(() => {
    conversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // Convex mutation to store messages
  const addMessage = useMutation(api.messages.add);
  const { isSignedIn } = useAuthStatus();

  // at top inside component
  const generatedTitleSet = useRef<Set<string>>(new Set());

  // Set up chat with AI SDK
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
    onFinish: async (message) => {
      const convId = conversationIdRef.current;
      if (convId) {
        try {
          if (isSignedIn) {
            await addMessage({
              conversationId: convId as unknown as Id<'conversations'>,
              role: message.role as 'user' | 'assistant' | 'system',
              content: message.content,
              metadata:
                message.toolInvocations && message.toolInvocations.length > 0
                  ? {
                      toolCalls: message.toolInvocations.map((t) => ({
                        toolName: t.toolName,
                        args: t.args,
                        timestamp: Date.now(),
                      })),
                      model: selectedModel,
                    }
                  : { model: selectedModel },
            });
          }

          await updateConversation(convId, {
            model: selectedModel,
            mcpEnabled: mcpConnected,
          });

          // modify onFinish block after persisting
          if (!generatedTitleSet.current.has(convId)) {
            const newTitle = await fetchGeneratedTitle([...messages, message]);
            if (newTitle && newTitle !== 'New Chat') {
              await updateConversation(convId, { title: newTitle });
            }
            generatedTitleSet.current.add(convId);
          }
        } catch (err) {
          console.error('Failed to persist assistant message', err);
        }
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // =============================================================================
  // COMPUTED STATE
  // =============================================================================

  // Check if this is the first message (only welcome message exists)
  const isFirstMessage =
    currentConversation?.messages.length === 1 &&
    currentConversation.messages[0].role === 'assistant' &&
    currentConversation.messages[0].id === 'welcome';

  const hasUserMessages = messages.some((m) => m.role === 'user');

  // Check if this should show centered layout - either no conversation, or empty conversation with no user messages
  const showCenteredLayout =
    !currentConversationId ||
    (currentConversation?.messages.length === 0 && !hasUserMessages) ||
    (isFirstMessage && !hasUserMessages);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  const handleCreateNewConversation = async () => {
    try {
      switchConversation(null);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };

  const handleSwitchConversation = (conversationId: string) => {
    switchConversation(conversationId);
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

  const processAttachedFiles = (attachedFiles: AttachedFile[]) => {
    let messageContent = input.trim();
    const messageAttachments: MessageAttachment[] = [];

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

    return { messageContent, messageAttachments };
  };

  const handleSubmitWithSave = async (
    e: React.FormEvent,
    attachedFiles?: AttachedFile[]
  ) => {
    e.preventDefault();

    // Process attached files if any
    const { messageContent, messageAttachments } = attachedFiles?.length
      ? processAttachedFiles(attachedFiles)
      : { messageContent: input.trim(), messageAttachments: [] };

    // Only proceed if we have content to send
    if (!messageContent && messageAttachments.length === 0) {
      return;
    }

    try {
      // If no current conversation exists, create one first
      let conversationId = currentConversationId;
      if (!conversationId) {
        const newConv = await createConversation(selectedModel, mcpConnected);
        conversationId = newConv.id;
        setMessages([]);
        conversationIdRef.current = conversationId;
      }

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
      } as React.ChangeEvent<HTMLTextAreaElement>);

      // Use the append function to add the message
      await append(messageObject);

      // Persist user message to Convex
      if (conversationId) {
        if (isSignedIn) {
          await addMessage({
            conversationId: conversationId as unknown as Id<'conversations'>,
            role: 'user',
            content: messageContent,
          });
        }
        await updateConversation(conversationId, {
          model: selectedModel,
          mcpEnabled: mcpConnected,
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  // Don't render until conversations are loaded to prevent hydration issues
  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full bg-background items-center justify-center">
        <div className="text-foreground/60">Loading...</div>
      </div>
    );
  }

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
            <WelcomeLayout
              input={input}
              isLoading={status === 'streaming'}
              selectedModel={selectedModel}
              mcpConnected={mcpConnected}
              onInputChange={handleInputChange}
              onSubmit={handleSubmitWithSave}
              onModelChange={handleModelChange}
              onMcpToggle={handleMcpToggle}
            />
          ) : (
            <ChatLayout
              messages={messages}
              input={input}
              isLoading={status === 'streaming'}
              selectedModel={selectedModel}
              mcpConnected={mcpConnected}
              onInputChange={handleInputChange}
              onSubmit={handleSubmitWithSave}
              onModelChange={handleModelChange}
              onMcpToggle={handleMcpToggle}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface WelcomeLayoutProps {
  input: string;
  isLoading: boolean;
  selectedModel: string;
  mcpConnected: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (
    e: React.FormEvent,
    attachedFiles?: AttachedFile[]
  ) => Promise<void>;
  onModelChange: (model: string) => void;
  onMcpToggle: () => void;
}

function WelcomeLayout({
  input,
  isLoading,
  selectedModel,
  mcpConnected,
  onInputChange,
  onSubmit,
  onModelChange,
  onMcpToggle,
}: WelcomeLayoutProps) {
  return (
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
          I&apos;m here to help you with PrivMX development. Ask me anything
          about code generation, APIs, architecture, or best practices.
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
          isLoading={isLoading}
          selectedModel={selectedModel}
          mcpConnected={mcpConnected}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onModelChange={onModelChange}
          onMcpToggle={onMcpToggle}
        />
      </motion.div>
    </motion.div>
  );
}

interface ChatLayoutProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  selectedModel: string;
  mcpConnected: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (
    e: React.FormEvent,
    attachedFiles?: AttachedFile[]
  ) => Promise<void>;
  onModelChange: (model: string) => void;
  onMcpToggle: () => void;
}

function ChatLayout({
  messages,
  input,
  isLoading,
  selectedModel,
  mcpConnected,
  onInputChange,
  onSubmit,
  onModelChange,
  onMcpToggle,
}: ChatLayoutProps) {
  return (
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
        <ChatArea messages={messages} isLoading={isLoading} />
      </motion.div>

      <motion.div
        className="sticky bottom-0 align-center border-radius-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
        layout
      >
        <ChatInput
          input={input}
          isLoading={isLoading}
          selectedModel={selectedModel}
          mcpConnected={mcpConnected}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onModelChange={onModelChange}
          onMcpToggle={onMcpToggle}
        />
      </motion.div>
    </motion.div>
  );
}

// helper to fetch title
async function fetchGeneratedTitle(msgs: Message[]): Promise<string | null> {
  try {
    const res = await fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs.slice(0, 4) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.title as string;
  } catch {
    return null;
  }
}
