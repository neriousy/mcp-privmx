import { getAuthUserId } from '@convex-dev/auth/server';
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Get messages for a conversation
export const list = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return [];
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      return [];
    }

    // Get messages ordered by creation time
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_created', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    return messages;
  },
});

// Add a new message to a conversation
export const add = mutation({
  args: {
    conversationId: v.id('conversations'),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),
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
    isStreaming: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      throw new Error('Not authorized');
    }

    // Create the message
    const messageId = await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      isStreaming: args.isStreaming || false,
      streamCompleted: !args.isStreaming,
      createdAt: Date.now(),
      completedAt: args.isStreaming ? undefined : Date.now(),
    });

    // Update conversation's updatedAt
    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Update an existing message
export const update = mutation({
  args: {
    messageId: v.id('messages'),
    content: v.optional(v.string()),
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
    isStreaming: v.optional(v.boolean()),
    streamCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      throw new Error('Not authorized');
    }

    // Update message
    const updates: Partial<{
      content: string;
      metadata: {
        toolCalls?: Array<{
          toolName: string;
          args: unknown;
          result?: unknown;
          timestamp: number;
        }>;
        model?: string;
        tokens?: {
          prompt: number;
          completion: number;
        };
        attachments?: Array<{
          name: string;
          contentType: string;
          url: string;
        }>;
      };
      isStreaming: boolean;
      streamCompleted: boolean;
      completedAt: number;
    }> = {};

    if (args.content !== undefined) updates.content = args.content;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.isStreaming !== undefined) updates.isStreaming = args.isStreaming;
    if (args.streamCompleted !== undefined) {
      updates.streamCompleted = args.streamCompleted;
      if (args.streamCompleted) {
        updates.completedAt = Date.now();
      }
    }

    await ctx.db.patch(args.messageId, updates);

    // Update conversation's updatedAt
    await ctx.db.patch(message.conversationId, {
      updatedAt: Date.now(),
    });

    return args.messageId;
  },
});

// Delete a message
export const remove = mutation({
  args: { messageId: v.id('messages') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      throw new Error('Not authorized');
    }

    // Delete associated stream chunks
    const chunks = await ctx.db
      .query('streamChunks')
      .withIndex('by_message', (q) => q.eq('messageId', args.messageId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete the message
    await ctx.db.delete(args.messageId);

    // Update conversation's updatedAt
    await ctx.db.patch(message.conversationId, {
      updatedAt: Date.now(),
    });

    return args.messageId;
  },
});

// Update streaming progress for a message
export const updateStreamProgress = mutation({
  args: {
    messageId: v.id('messages'),
    currentPosition: v.number(),
    totalEstimated: v.optional(v.number()),
    chunksReceived: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      throw new Error('Not authorized');
    }

    await ctx.db.patch(args.messageId, {
      streamProgress: {
        currentPosition: args.currentPosition,
        totalEstimated: args.totalEstimated,
        chunksReceived: args.chunksReceived,
        lastChunkAt: Date.now(),
      },
    });

    return args.messageId;
  },
});
