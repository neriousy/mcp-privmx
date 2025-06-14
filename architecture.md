# PrivMX Chat + Convex Architecture

## 🏗️ Architecture Overview

This document outlines the integration of **Convex** as the backend for the PrivMX AI Chat application with MCP (Model Context Protocol), providing **persistent/regenerative AI chat streams**, real-time data sync, authentication, and cloud-based conversations while maintaining the existing MCP functionality.

## 📋 Current vs. Proposed Architecture

### Current State

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   MCP Services   │    │  localStorage   │
│  (Vercel Edge)  │ ─► │   (API Routes)   │ ─► │  (Client Side)  │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Proposed Architecture with Persistent Streams

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   MCP Services   │    │     Convex      │
│  (Multi-tab)    │ ─► │   (API Routes)   │    │   (Backend)     │
│                 │    │                  │    │ Persistent      │
└─────┬───────────┘    └──────────────────┘    │ Streams         │
      │                                        └─────────────────┘
      │                ┌─────────────────┐               ▲
      └─────────────── │ Convex Client   │ ──────────────┘
                       │ (Real-time sync)│
                       │ Stream Recovery │
                       └─────────────────┘
```

## 🌊 Core Stream Requirements

### 1. **Persistent/Regenerative Streams**

- **Show Progress**: Display what was already generated + continue from current position
- **Complete Streams**: If stream ended, show final result (no re-streaming)
- **Page Refresh**: Seamless recovery without losing progress
- **Backend Writing**: Stream chunks written to Convex in real-time

### 2. **Multi-Conversation Streaming**

- **Independent Streams**: Each conversation maintains its own streaming state
- **Seamless Switching**: Switch between conversations without losing stream progress
- **Concurrent Streams**: Multiple conversations can stream simultaneously
- **Thread Isolation**: Thread A streaming doesn't affect Thread B

### 3. **Real-Time Sync Across Tabs/Devices**

- **Cross-Tab Sync**: Thread A on Tab A mirrors Thread A on Tab B
- **Same State**: Identical stream progress and content across all instances
- **Live Updates**: New messages appear instantly on all tabs
- **Device Sync**: Same experience across different devices

### 4. **MCP Integration in Conversations**

- **Tool Results**: MCP tool calls and results stored as conversation messages
- **Persistent Tools**: Tool execution history maintained across sessions
- **Real-Time Tools**: Tool results sync across tabs instantly

### 5. **Stream Control**

- **Stop Stream**: Users can halt active streams
- **Retry Stream**: Manual retry button for failed/interrupted streams
- **Auto-Cleanup**: Stream state cleaned up when completed
- **Recovery Button**: Manual recovery option instead of automatic

## 💾 Enhanced Data Schema for Persistent Streams

### Core Entities

```typescript
// src/convex/schema.ts
export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    avatar: v.optional(v.string()),
    preferences: v.object({
      defaultModel: v.string(),
      mcpEnabled: v.boolean(),
      theme: v.optional(v.string()),
    }),
  }).index('by_email', ['email']),

  conversations: defineTable({
    userId: v.id('users'),
    title: v.string(),
    model: v.string(),
    mcpEnabled: v.boolean(),
    isArchived: v.boolean(),

    // Stream State for the entire conversation
    streamState: v.optional(
      v.object({
        hasActiveStream: v.boolean(),
        activeMessageId: v.optional(v.id('messages')),
        streamStartedAt: v.optional(v.number()),
        lastActivity: v.number(),
      })
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_updated', ['userId', 'updatedAt'])
    .index('by_active_streams', ['streamState.hasActiveStream']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),

    // Enhanced metadata for MCP and streaming
    metadata: v.optional(
      v.object({
        toolCalls: v.optional(
          v.array(
            v.object({
              toolName: v.string(),
              args: v.any(),
              result: v.optional(v.any()),
              timestamp: v.number(),
            })
          )
        ),
        model: v.optional(v.string()),
        tokens: v.optional(
          v.object({
            prompt: v.number(),
            completion: v.number(),
          })
        ),
      })
    ),

    // Streaming state for this specific message
    isStreaming: v.boolean(),
    streamCompleted: v.boolean(),
    streamProgress: v.optional(
      v.object({
        currentPosition: v.number(), // Character position
        totalEstimated: v.optional(v.number()),
        chunksReceived: v.number(),
        lastChunkAt: v.number(),
      })
    ),

    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_conversation_created', ['conversationId', 'createdAt'])
    .index('by_streaming', ['isStreaming'])
    .index('by_active_streams', ['conversationId', 'isStreaming']),

  // Real-time stream chunks for recovery
  streamChunks: defineTable({
    messageId: v.id('messages'),
    conversationId: v.id('conversations'), // For efficient queries
    userId: v.id('users'),

    chunkIndex: v.number(), // Order of chunks
    content: v.string(), // The actual chunk content
    timestamp: v.number(),

    // Metadata for debugging/recovery
    chunkSize: v.number(),
    isComplete: v.boolean(), // Is this the final chunk?
  })
    .index('by_message', ['messageId'])
    .index('by_message_order', ['messageId', 'chunkIndex'])
    .index('by_conversation', ['conversationId'])
    .index('by_timestamp', ['timestamp']),

  // Stream sessions for cross-tab coordination
  streamSessions: defineTable({
    conversationId: v.id('conversations'),
    messageId: v.id('messages'),
    userId: v.id('users'),

    status: v.union(
      v.literal('active'), // Currently streaming
      v.literal('paused'), // User paused
      v.literal('completed'), // Successfully completed
      v.literal('failed'), // Failed/interrupted
      v.literal('cancelled') // User cancelled
    ),

    // Recovery information
    lastKnownPosition: v.number(), // Last confirmed position
    totalContent: v.string(), // Accumulated content so far

    // Timing information
    startedAt: v.number(),
    lastActiveAt: v.number(),
    completedAt: v.optional(v.number()),

    // Error handling
    errorInfo: v.optional(
      v.object({
        message: v.string(),
        code: v.optional(v.string()),
        timestamp: v.number(),
      })
    ),
  })
    .index('by_user', ['userId'])
    .index('by_conversation', ['conversationId'])
    .index('by_message', ['messageId'])
    .index('by_status', ['status'])
    .index('by_active', ['status', 'lastActiveAt']),
});
```

## 🔄 Persistent Stream Implementation

### Stream State Management

```typescript
// src/convex/streams.ts
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentUser } from './users';

// Start a new stream session
export const startStream = mutation({
  args: {
    conversationId: v.id('conversations'),
    messageId: v.id('messages'),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Create stream session
    const sessionId = await ctx.db.insert('streamSessions', {
      conversationId: args.conversationId,
      messageId: args.messageId,
      userId: user._id,
      status: 'active',
      lastKnownPosition: 0,
      totalContent: '',
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // Update conversation stream state
    await ctx.db.patch(args.conversationId, {
      streamState: {
        hasActiveStream: true,
        activeMessageId: args.messageId,
        streamStartedAt: Date.now(),
        lastActivity: Date.now(),
      },
      updatedAt: Date.now(),
    });

    // Update message streaming state
    await ctx.db.patch(args.messageId, {
      isStreaming: true,
      streamCompleted: false,
      streamProgress: {
        currentPosition: 0,
        chunksReceived: 0,
        lastChunkAt: Date.now(),
      },
    });

    return sessionId;
  },
});

// Add chunk to stream
export const addStreamChunk = mutation({
  args: {
    sessionId: v.id('streamSessions'),
    messageId: v.id('messages'),
    content: v.string(),
    isComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Stream session not active');
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Get current chunk count
    const existingChunks = await ctx.db
      .query('streamChunks')
      .withIndex('by_message', (q) => q.eq('messageId', args.messageId))
      .collect();

    const chunkIndex = existingChunks.length;
    const newPosition = session.lastKnownPosition + args.content.length;
    const newTotalContent = session.totalContent + args.content;

    // Store the chunk
    await ctx.db.insert('streamChunks', {
      messageId: args.messageId,
      conversationId: session.conversationId,
      userId: session.userId,
      chunkIndex,
      content: args.content,
      chunkSize: args.content.length,
      isComplete: args.isComplete || false,
      timestamp: Date.now(),
    });

    // Update message content and progress
    await ctx.db.patch(args.messageId, {
      content: newTotalContent,
      streamProgress: {
        currentPosition: newPosition,
        chunksReceived: chunkIndex + 1,
        lastChunkAt: Date.now(),
      },
    });

    // Update session
    await ctx.db.patch(args.sessionId, {
      lastKnownPosition: newPosition,
      totalContent: newTotalContent,
      lastActiveAt: Date.now(),
    });

    // If complete, finalize the stream
    if (args.isComplete) {
      await completeStream(ctx, args.sessionId);
    }

    return {
      position: newPosition,
      totalContent: newTotalContent,
      chunkIndex,
    };
  },
});

// Get active streams for a user (for recovery)
export const getActiveStreams = query({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, args) => {
    const user = args.userId
      ? await ctx.db.get(args.userId)
      : await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query('streamSessions')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .filter((q) => q.eq(q.field('userId'), user._id))
      .collect();
  },
});

// Get stream recovery data
export const getStreamRecoveryData = query({
  args: {
    conversationId: v.id('conversations'),
    messageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error('Conversation not found');
    }

    // Get active stream session for this conversation
    const activeSession = await ctx.db
      .query('streamSessions')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .filter((q) => q.eq(q.field('status'), 'active'))
      .first();

    if (!activeSession) {
      return { hasActiveStream: false };
    }

    // Get the streaming message
    const streamingMessage = await ctx.db.get(activeSession.messageId);

    return {
      hasActiveStream: true,
      session: activeSession,
      message: streamingMessage,
      canRecover: true,
    };
  },
});
```

### Real-Time Hook Implementation

```typescript
// src/hooks/useStreamRecovery.ts
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useCallback, useEffect } from 'react';

export function useStreamRecovery(conversationId: string) {
  // Real-time stream recovery data
  const recoveryData = useQuery(api.streams.getStreamRecoveryData, {
    conversationId,
  });

  // All active streams for this user
  const activeStreams = useQuery(api.streams.getActiveStreams);

  // Mutations for stream control
  const stopStream = useMutation(api.streams.stopStream);
  const retryStream = useMutation(api.streams.retryStream);

  // Check if this conversation has an active stream
  const hasActiveStream = recoveryData?.hasActiveStream || false;
  const streamingMessage = recoveryData?.message;

  // Auto-recovery effect (runs when component mounts)
  useEffect(() => {
    if (hasActiveStream && recoveryData?.canRecover) {
      console.log(
        '🔄 Stream recovery available for conversation',
        conversationId
      );
      // The UI can show recovery options or auto-continue
    }
  }, [hasActiveStream, recoveryData?.canRecover, conversationId]);

  const handleStopStream = useCallback(async () => {
    if (recoveryData?.session) {
      await stopStream({ sessionId: recoveryData.session._id });
    }
  }, [recoveryData?.session, stopStream]);

  const handleRetryStream = useCallback(async () => {
    if (recoveryData?.session) {
      await retryStream({ sessionId: recoveryData.session._id });
    }
  }, [recoveryData?.session, retryStream]);

  return {
    // Stream state
    hasActiveStream,
    streamingMessage,
    streamSession: recoveryData?.session,

    // Recovery data
    canRecover: recoveryData?.canRecover || false,
    lastKnownPosition: recoveryData?.session?.lastKnownPosition || 0,
    totalContent: recoveryData?.session?.totalContent || '',

    // Actions
    stopStream: handleStopStream,
    retryStream: handleRetryStream,

    // Loading states
    isLoading: recoveryData === undefined,
  };
}
```

### Enhanced useConversations Hook

```typescript
// src/hooks/useConversations.ts (Enhanced with Convex)
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useStreamRecovery } from './useStreamRecovery';

export function useConversations() {
  // ✨ All of these auto-update in real-time!
  const conversations = useQuery(api.conversations.list);
  const createConversation = useMutation(api.conversations.create);
  const updateConversation = useMutation(api.conversations.update);
  const deleteConversation = useMutation(api.conversations.remove);

  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);

  // Real-time message subscription for current conversation
  const messages = useQuery(
    api.messages.list,
    currentConversationId ? { conversationId: currentConversationId } : 'skip'
  );

  // Stream recovery for current conversation
  const streamRecovery = useStreamRecovery(currentConversationId || '');

  // Current conversation with real-time updates
  const currentConversation = useMemo(() => {
    return conversations?.find((c) => c._id === currentConversationId) || null;
  }, [conversations, currentConversationId]);

  // Enhanced conversation switching with stream awareness
  const switchConversation = useCallback(
    (newConversationId: string) => {
      console.log('🔄 Switching conversations', {
        from: currentConversationId,
        to: newConversationId,
        currentHasStream: streamRecovery.hasActiveStream,
      });

      setCurrentConversationId(newConversationId);

      // No need to stop streams - they continue independently
    },
    [currentConversationId, streamRecovery.hasActiveStream]
  );

  return {
    // Data (all real-time!)
    conversations,
    currentConversation,
    messages,

    // Stream state for current conversation
    hasActiveStream: streamRecovery.hasActiveStream,
    streamingMessage: streamRecovery.streamingMessage,
    canRecoverStream: streamRecovery.canRecover,

    // Actions
    createConversation,
    updateConversation,
    deleteConversation,
    switchConversation,

    // Stream controls
    stopStream: streamRecovery.stopStream,
    retryStream: streamRecovery.retryStream,

    // Loading states
    isLoading: conversations === undefined || streamRecovery.isLoading,
  };
}
```

## 🚀 Implementation Status

### ✅ Phase 1: Convex Setup & Basic Persistence

1. ✅ **Setup Convex**: Schema and basic functions created
2. ✅ **Authentication**: Google OAuth configuration ready
3. ✅ **Core Functions**: Users, conversations, messages, streams
4. 🔄 **React Integration**: Hooks and providers implemented
5. 🔄 **UI Components**: Auth components needed

### 🔄 Phase 2: Persistent Streaming Core

1. ✅ **Stream sessions**: Complete StreamSessions implementation
2. ✅ **Chunk storage**: High-frequency real-time chunk writing
3. ✅ **Cross-tab sync**: Mirror functionality implemented
4. 🔄 **Chat API Integration**: Update existing chat route
5. 🔄 **Stream Recovery UI**: Recovery indicators and controls

### 📋 Phase 3: Enhanced Stream Features

1. 🔄 **Stream controls**: Stop/retry UI components
2. ✅ **MCP integration**: Tool calls in message metadata
3. 🔄 **Recovery UI**: Manual recovery buttons and indicators
4. 🔄 **Migration**: localStorage to Convex transition

### 📋 Phase 4: Polish & Optimization

1. 🔄 **Performance**: Query optimization and caching
2. 🔄 **Error handling**: Robust stream failure recovery
3. ✅ **Cleanup**: 6-hour automatic cleanup implemented
4. 🔄 **Deployment**: Vercel + Convex production setup

## 📊 Key Benefits

### User Experience

- **Seamless Switching**: Move between conversations without losing progress
- **Cross-Tab Sync**: Same experience across all browser tabs
- **Persistent Progress**: Never lose work due to refresh/navigation
- **Real-Time Collaboration**: Same conversation state across devices

### Technical Benefits

- **Scalable Streaming**: Handle multiple concurrent streams efficiently
- **Reliable Recovery**: Robust stream state management
- **Real-Time Architecture**: Built on Convex's real-time foundation
- **MCP Integration**: Tool results as part of conversation flow

This architecture provides the foundation for truly persistent, regenerative AI chat streams with real-time synchronization across all user touchpoints.
