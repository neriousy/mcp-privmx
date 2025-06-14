# Architecture Roadmap & Implementation TODO

## 🎯 Current Status: Phase 2 - Persistent Streaming Core

### ✅ Completed Items

#### Phase 1: Foundation

- [] Convex schema with streaming support (`src/convex/schema.ts`)
- [] User management functions (`src/convex/users.ts`)
- [] Conversation management (`src/convex/conversations.ts`)
- [] Message management with MCP integration (`src/convex/messages.ts`)
- [] Stream management functions (`src/convex/streams.ts`)
- [x] Google OAuth auth config (`src/convex/auth.config.ts`)
- [x] Convex React provider (`src/providers/ConvexProvider.tsx`)
- [] Enhanced useConversations hook (`src/hooks/useConversationsConvex.ts`)

---

## 🔄 Current Sprint: Authentication & UI Integration

### Priority 1: Authentication Flow

- [x] **Google Sign-In Components**

  - [x] SignInButton component
  - [x] AuthenticatedLayout wrapper
  - [x] User profile dropdown
  - [x] Sign out functionality

- [ ] **Auth State Management**

  - [ ] useAuth hook wrapper
  - [ ] Protected routes logic
  - [ ] Auto user creation on first sign-in

- [ ] **OAuth Configuration**
  - [ ] Set up redirect URIs for Vercel deployment
  - [ ] Environment variable setup guide
  - [ ] Test auth flow locally and on Vercel

### Priority 2: App Integration

- [ ] **Main App Updates**

  - [ ] Replace localStorage useConversations with useConversationsConvex
  - [ ] Wrap app with ConvexProvider
  - [ ] Update layout.tsx with auth components
  - [ ] Add loading states for auth

- [ ] **Chat API Integration**
  - [ ] Update /api/chat route to work with Convex streaming
  - [ ] Implement real-time chunk writing to Convex
  - [ ] Add stream session management to API

---

## 📋 Next Sprint: Stream Recovery & UI

### Priority 1: Stream Recovery UI

- [ ] **Recovery Components**

  - [ ] StreamRecoveryBanner (shows when recovery available)
  - [ ] StreamControls (stop/retry buttons)
  - [ ] StreamProgressIndicator
  - [ ] FailedStreamRetryDialog

- [ ] **Recovery Logic**
  - [ ] Auto-recovery on page load
  - [ ] Manual recovery trigger
  - [ ] Cross-tab coordination indicators
  - [ ] Stream failure handling

### Priority 2: Enhanced Chat Components

- [ ] **Message Components**

  - [ ] Update ChatMessage to show MCP tool calls
  - [ ] Stream progress indicators
  - [ ] Tool call status indicators
  - [ ] Retry buttons for failed messages

- [ ] **Conversation Management**
  - [ ] Real-time conversation list updates
  - [ ] Active stream indicators in sidebar
  - [ ] Auto-title generation integration

---

## 🚀 Future Sprints

### Sprint 3: Migration & Polish

- [ ] **Data Migration**

  - [ ] localStorage to Convex migration utility
  - [ ] Migration UI/progress indicator
  - [ ] Rollback mechanism if needed

- [ ] **Performance Optimization**
  - [ ] Query optimization for large conversation histories
  - [ ] Pagination for messages
  - [ ] Caching strategy for frequently accessed data

### Sprint 4: Advanced Features

- [ ] **Enhanced Streaming**

  - [ ] Stream pause/resume functionality
  - [ ] Bandwidth-aware chunk sizing
  - [ ] Stream quality indicators

- [ ] **Collaboration Features**
  - [ ] Conversation sharing (future)
  - [ ] Multi-user conversations (future)
  - [ ] Export functionality

---

## 🔧 Technical Debt & Improvements

### Code Quality

- [ ] Fix TypeScript linter errors (waiting for `npx convex dev`)
- [ ] Add comprehensive error boundaries
- [ ] Implement proper loading states everywhere
- [ ] Add retry logic for failed mutations

### Testing

- [ ] Unit tests for Convex functions
- [ ] Integration tests for auth flow
- [ ] E2E tests for streaming functionality
- [ ] Cross-tab testing scenarios

### Monitoring & Debugging

- [ ] Add comprehensive logging
- [ ] Performance monitoring for stream operations
- [ ] Error tracking and alerting
- [ ] Stream session analytics

---

## 🌐 Deployment Configuration

### Vercel Setup

- [ ] Environment variables configuration
- [ ] OAuth redirect URIs setup
- [ ] Convex deployment connection
- [ ] Edge function configuration

### Security

- [ ] Review auth token handling
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Audit user data access patterns

---

## 📚 Documentation

### User Documentation

- [ ] Authentication setup guide
- [ ] Stream recovery user guide
- [ ] Troubleshooting common issues
- [ ] Feature comparison (before/after)

### Developer Documentation

- [ ] API documentation for Convex functions
- [ ] Architecture decision records
- [ ] Deployment guide
- [ ] Contributing guidelines

---

## 🎯 Success Metrics

### Performance Targets

- [ ] Stream recovery time < 2 seconds
- [ ] Cross-tab sync latency < 500ms
- [ ] Authentication flow < 3 seconds
- [ ] Message loading time < 100ms

### User Experience

- [ ] Zero data loss during stream interruptions
- [ ] Seamless conversation switching
- [ ] Intuitive stream recovery UX
- [ ] Responsive cross-device experience

---

## 🚨 Risks & Mitigations

### Technical Risks

- **Risk**: Convex rate limits with high-frequency chunks
- **Mitigation**: Implement adaptive chunk sizing and batching

- **Risk**: OAuth configuration issues on deployment
- **Mitigation**: Comprehensive testing with staging environment

- **Risk**: Data migration failures
- **Mitigation**: Incremental migration with rollback capability

### User Experience Risks

- **Risk**: Confusing stream recovery UX
- **Mitigation**: Clear visual indicators and user education

- **Risk**: Performance degradation with large conversations
- **Mitigation**: Pagination and lazy loading implementation

---

## 📝 Notes

### Current Focus

Working on authentication UI components and Google OAuth setup for Vercel deployment.

### Recent Decisions

- High-frequency chunk writing for real-time experience
- MCP tool calls embedded in message metadata
- 6-hour cleanup for stream sessions
- Cross-tab mirroring for stream operations

### Next Major Milestones

1. Complete authentication flow (this week)
2. Integrate streaming with chat API (next week)
3. Deploy to Vercel with full functionality (end of month)
