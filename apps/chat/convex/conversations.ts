import { getAuthUserId } from '@convex-dev/auth/server';
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

// Get user's conversations
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    // Get conversations ordered by most recent
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_user_updated', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();

    // Get all messages for this user in a single query (fixes N+1 problem)
    const allUserMessages = await ctx.db
      .query('messages')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    // Group messages by conversation ID
    const messagesByConversationId = new Map<string, typeof allUserMessages>();
    for (const message of allUserMessages) {
      const conversationId = message.conversationId;
      if (!messagesByConversationId.has(conversationId)) {
        messagesByConversationId.set(conversationId, []);
      }
      messagesByConversationId.get(conversationId)!.push(message);
    }

    // Sort messages by createdAt for each conversation
    for (const messages of messagesByConversationId.values()) {
      messages.sort((a, b) => a.createdAt - b.createdAt);
    }

    // Enrich conversations with their messages
    const conversationsWithMessages = conversations.map((conversation) => ({
      ...conversation,
      messages: messagesByConversationId.get(conversation._id) || [],
    }));

    return conversationsWithMessages;
  },
});

// Get a specific conversation with messages
export const get = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      return null;
    }

    // Get messages
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_created', (q) =>
        q.eq('conversationId', conversation._id)
      )
      .collect();

    return {
      ...conversation,
      messages,
    };
  },
});

// Create a new conversation
export const create = mutation({
  args: {
    title: v.string(),
    model: v.string(),
    mcpEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    // Create the conversation
    const conversationId = await ctx.db.insert('conversations', {
      userId: userId,
      title: args.title,
      model: args.model,
      mcpEnabled: args.mcpEnabled,
      isArchived: false,
      hasActiveStream: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return conversationId;
  },
});

// Update a conversation
export const update = mutation({
  args: {
    conversationId: v.id('conversations'),
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    mcpEnabled: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    streamState: v.optional(
      v.object({
        hasActiveStream: v.boolean(),
        activeMessageId: v.optional(v.id('messages')),
        streamStartedAt: v.optional(v.number()),
        lastActivity: v.number(),
      })
    ),
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

    // Update conversation
    const updates: Partial<{
      title: string;
      model: string;
      mcpEnabled: boolean;
      isArchived: boolean;
      streamState: {
        hasActiveStream: boolean;
        activeMessageId?: Id<'messages'>;
        streamStartedAt?: number;
        lastActivity: number;
      };
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.model !== undefined) updates.model = args.model;
    if (args.mcpEnabled !== undefined) updates.mcpEnabled = args.mcpEnabled;
    if (args.isArchived !== undefined) updates.isArchived = args.isArchived;
    if (args.streamState !== undefined) {
      updates.streamState = {
        ...conversation.streamState,
        ...args.streamState,
      };
    }

    await ctx.db.patch(args.conversationId, updates);
    return args.conversationId;
  },
});

// Delete a conversation
export const remove = mutation({
  args: { conversationId: v.id('conversations') },
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

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_created', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete stream chunks
    const chunks = await ctx.db
      .query('streamChunks')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete stream sessions
    const sessions = await ctx.db
      .query('streamSessions')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Finally delete the conversation
    await ctx.db.delete(args.conversationId);
    return args.conversationId;
  },
});

// Generate title for conversation
export const generateTitle = mutation({
  args: {
    conversationId: v.id('conversations'),
    title: v.string(),
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

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });

    return args.conversationId;
  },
});
