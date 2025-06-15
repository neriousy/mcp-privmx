import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import { Conversation } from '@/types';
import { SidebarFooter } from './SidebarFooter';

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onCreateNewConversation: () => void;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

// Removed formatDate function since we're no longer showing dates

export function ChatSidebar({
  conversations,
  currentConversationId,
  onCreateNewConversation,
  onSwitchConversation,
  onDeleteConversation,
}: ChatSidebarProps) {
  return (
    <div className="w-64 h-full bg-sidebar-background border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-sidebar-foreground">
              PrivMX AI
            </h1>
            <p className="text-xs text-sidebar-foreground/60">
              Development Assistant
            </p>
          </div>
        </div>

        <Button onClick={onCreateNewConversation} className="w-full" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar-thin">
        <div className="space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-sidebar-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-sidebar-foreground/50">
                No conversations yet
              </p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group relative rounded-lg p-3 cursor-pointer transition-all hover:bg-sidebar-accent ${
                  conversation.id === currentConversationId
                    ? 'bg-sidebar-accent border border-sidebar-primary/20'
                    : 'hover:bg-sidebar-accent/50'
                }`}
                onClick={() => onSwitchConversation(conversation.id)}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-sidebar-foreground/60 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-sidebar-foreground truncate">
                      {conversation.title}
                    </h3>
                  </div>
                </div>

                {/* Delete Button - Now always visible */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conversation.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-sidebar-border rounded"
                >
                  <Trash2 className="w-3 h-3 text-sidebar-foreground/60 hover:text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer - Now positioned at the bottom */}
      <SidebarFooter />
    </div>
  );
}
