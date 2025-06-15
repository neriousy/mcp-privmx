import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

const schema = defineSchema({
  ...authTables,

  // User profiles (extends auth user data)
  userProfiles: defineTable({
    userId: v.id('users'), // Reference to auth users table
    preferences: v.object({
      defaultModel: v.string(),
      mcpEnabled: v.boolean(),
      theme: v.optional(v.string()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Conversations
  conversations: defineTable({
    userId: v.id('users'), // Reference to auth users table
    title: v.string(),
    model: v.string(),
    mcpEnabled: v.boolean(),
    isArchived: v.boolean(),
    hasActiveStream: v.boolean(), // Promoted to top-level for indexing

    // Stream State for the entire conversation
    streamState: v.optional(
      v.object({
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
    .index('conversations_by_active_streams', ['hasActiveStream']),

  // Messages
  messages: defineTable({
    conversationId: v.id('conversations'),
    userId: v.id('users'), // Add userId for efficient bulk queries
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),

    // Enhanced metadata for MCP and streaming
    // WARNING: Keep metadata objects small to avoid Convex 16KB document limit
    // For large payloads (toolCalls args/result, attachments), use messageMetadata table
    metadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        tokens: v.optional(
          v.object({
            prompt: v.number(),
            completion: v.number(),
          })
        ),
        // Basic tool call info - full data goes in messageMetadata table
        toolCallCount: v.optional(v.number()),
        hasAttachments: v.optional(v.boolean()),
        // Allow toolCalls array directly in metadata
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
        // Allow attachments array directly in metadata
        attachments: v.optional(
          v.array(
            v.object({
              name: v.string(),
              contentType: v.string(),
              url: v.string(),
            })
          )
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
    .index('by_user', ['userId']) // Add index for efficient user-based queries
    .index('by_conversation', ['conversationId'])
    .index('by_conversation_created', ['conversationId', 'createdAt'])
    .index('by_streaming', ['isStreaming'])
    .index('messages_by_active_streams', ['conversationId', 'isStreaming']),

  // Large metadata storage to avoid hitting 16KB document limit
  messageMetadata: defineTable({
    messageId: v.id('messages'),
    conversationId: v.id('conversations'), // For efficient cleanup
    userId: v.id('users'),
    type: v.union(
      v.literal('toolCalls'),
      v.literal('attachments'),
      v.literal('extended')
    ),

    // Large data that doesn't fit in main message
    data: v.any(), // Store toolCalls array, attachments array, or other large objects

    createdAt: v.number(),
  })
    .index('by_message', ['messageId'])
    .index('by_message_type', ['messageId', 'type'])
    .index('by_conversation', ['conversationId']),

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

export default schema;
