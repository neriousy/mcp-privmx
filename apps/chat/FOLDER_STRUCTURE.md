# Folder Structure Documentation

## Overview

This document describes the improved folder structure implemented to support the growing complexity of the PrivMX AI Chat application. The structure follows a **feature-based architecture** combined with **domain-driven design** principles.

## Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main chat page
│
├── components/            # Shared components
│   ├── layout/           # Layout-specific components
│   │   ├── Sidebar.tsx
│   │   ├── SidebarFooter.tsx
│   │   └── index.ts      # Barrel exports
│   └── ui/               # Reusable UI components
│       ├── FileAttachment.tsx
│       └── index.ts      # Barrel exports
│
├── features/             # Feature-based modules
│   ├── auth/            # Authentication feature
│   │   ├── components/  # Auth-specific components
│   │   │   └── SignInButton.tsx
│   │   ├── hooks/       # Auth-specific hooks
│   │   ├── types/       # Auth-specific types
│   │   └── index.ts     # Feature exports
│   │
│   ├── chat/            # Chat functionality
│   │   ├── components/  # Chat components
│   │   │   ├── ChatArea.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ToolCallCard.tsx
│   │   ├── hooks/       # Chat hooks
│   │   │   ├── useConversations.ts
│   │   │   ├── useFileUpload.ts
│   │   │   └── useSpeechRecognition.ts
│   │   ├── types/       # Chat-specific types
│   │   └── index.ts     # Feature exports
│   │
│   ├── stream/          # Streaming functionality
│   │   ├── components/  # Stream components
│   │   ├── hooks/       # Stream hooks
│   │   ├── types/       # Stream types
│   │   └── index.ts
│   │
│   └── mcp/             # MCP functionality
│       ├── components/  # MCP components
│       ├── hooks/       # MCP hooks
│       ├── types/       # MCP types
│       ├── mcp-controller.ts
│       └── index.ts
│
├── hooks/               # Global/shared hooks
├── lib/                 # Utilities and services
│   ├── controllers/     # Business logic controllers
│   ├── services/        # External services
│   │   └── service-manager.ts
│   ├── utils/           # Utility functions
│   │   ├── file-utils.ts
│   │   └── utils.ts
│   └── validators/      # Data validation
│
├── providers/           # React context providers
│   └── ConvexProvider.tsx
│
├── types/               # Global type definitions
│   └── index.ts         # Centralized types
│
├── convex/              # Convex backend functions
│   ├── _generated/      # Auto-generated files
│   ├── auth.ts
│   ├── schema.ts
│   └── user.ts
│
└── middleware.ts        # Next.js middleware
```

## Principles

### 1. Feature-Based Organization

- Each major feature has its own directory under `features/`
- Features contain their own components, hooks, and types
- Features are self-contained and can be developed independently

### 2. Separation of Concerns

- **Components**: UI components grouped by feature or purpose
- **Hooks**: Business logic and state management
- **Types**: TypeScript definitions for better development experience
- **Services**: External API integrations and business logic

### 3. Barrel Exports

- Each feature and directory has an `index.ts` file for clean imports
- Enables importing multiple exports from a single feature
- Example: `import { ChatArea, ChatInput, useConversations } from '@/features/chat'`

### 4. Centralized Types

- Global types are defined in `src/types/index.ts`
- Feature-specific types remain in their respective feature directories
- Reduces duplication and improves maintainability

## Import Patterns

### Before (Old Structure)

```typescript
import { ChatArea } from '../components/ChatArea';
import { ChatInput } from '../components/ChatInput';
import { useConversations } from '../hooks/useConversations';
import { SignIn } from '../components/auth/SignInButton';
```

### After (New Structure)

```typescript
import { ChatArea, ChatInput, useConversations } from '@/features/chat';
import { SignIn } from '@/features/auth';
import { Sidebar, SidebarFooter } from '@/components/layout';
```

## Benefits

1. **Scalability**: Easy to add new features without cluttering the structure
2. **Maintainability**: Related code is co-located
3. **Team Collaboration**: Different team members can work on different features
4. **Code Discovery**: Easy to find components and functionality
5. **Testing**: Feature-based testing is more straightforward
6. **Reusability**: Clear separation between shared and feature-specific code

## Migration Notes

- All imports have been updated to use the new structure
- Barrel exports enable clean imports without long relative paths
- The structure supports the upcoming Convex integration with persistent streams
- Types are now centralized for better consistency

## Future Extensions

As the application grows, additional features can be added:

- `features/admin/` - Admin functionality
- `features/settings/` - User settings
- `features/notifications/` - Real-time notifications
- `features/collaboration/` - Multi-user features

Each new feature follows the same pattern: `components/`, `hooks/`, `types/`, and `index.ts`.
