import { getAuthUserId } from '@convex-dev/auth/server';
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

// Get or create user profile
export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    // Get auth user data
    const authUser = await ctx.db.get(userId);
    if (!authUser) {
      return null;
    }

    // Get user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    return {
      _id: userId,
      name: authUser.name || 'Anonymous',
      email: authUser.email || '',
      image: authUser.image,
      preferences: userProfile?.preferences || {
        defaultModel: 'gpt-4o-mini',
        mcpEnabled: false,
        theme: 'system',
      },
      profileCreated: !!userProfile,
    };
  },
});

// Create or update user profile
export const upsertUserProfile = mutation({
  args: {
    preferences: v.object({
      defaultModel: v.string(),
      mcpEnabled: v.boolean(),
      theme: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    // Check if user profile already exists
    const existingProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        preferences: args.preferences,
        updatedAt: Date.now(),
      });
      return existingProfile._id;
    } else {
      // Create new profile
      return await ctx.db.insert('userProfiles', {
        userId,
        preferences: args.preferences,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Update user preferences
export const updateUserPreferences = mutation({
  args: {
    preferences: v.object({
      defaultModel: v.string(),
      mcpEnabled: v.boolean(),
      theme: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    // Get user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    if (!userProfile) {
      // Create profile if it doesn't exist
      return await ctx.db.insert('userProfiles', {
        userId,
        preferences: args.preferences,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(userProfile._id, {
      preferences: args.preferences,
      updatedAt: Date.now(),
    });

    return userProfile._id;
  },
});
