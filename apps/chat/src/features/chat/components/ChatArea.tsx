import { Sparkles } from 'lucide-react';
import { Message } from 'ai';
import { ChatMessage } from './ChatMessage';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
}

export function ChatArea({ messages, isLoading }: ChatAreaProps) {
  return (
    <div className="flex-1 overflow-y-auto h-full custom-scrollbar">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-32">
        {messages.map((message) => (
          <div key={message.id} className="group">
            <ChatMessage message={message} />
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-sidebar-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <Sparkles className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex space-x-1">
                <div
                  className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                ></div>
              </div>
              <span className="text-xs">Thinking...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
