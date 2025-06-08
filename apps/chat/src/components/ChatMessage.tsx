import ReactMarkdown from 'react-markdown';
import { Sparkles } from 'lucide-react';
import { Message } from 'ai';
import { ToolCallCard } from './ToolCallCard';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-2xl bg-sidebar-accent text-sidebar-foreground rounded-lg px-3 py-2">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 bg-sidebar-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
        <Sparkles className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="flex-1 max-w-2xl space-y-3">
        {/* Tool Calls */}
        {message.parts
          ?.filter((part) => part.type === 'tool-invocation')
          .map((part) => (
            <ToolCallCard
              key={part.toolInvocation.toolCallId}
              toolInvocation={part.toolInvocation}
            />
          ))}

        {/* Message Content */}
        {message.content && (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown
              className="text-foreground"
              components={{
                h1: ({ children }) => (
                  <h1 className="text-lg font-semibold mb-3 text-foreground">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold mb-2 text-foreground">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold mb-2 text-foreground">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="mb-2 text-sm text-foreground leading-relaxed">
                    {children}
                  </p>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <pre className="bg-muted rounded p-3 overflow-x-auto my-3">
                        <code className="text-xs text-muted-foreground font-mono">
                          {children}
                        </code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-muted-foreground">
                      {children}
                    </code>
                  );
                },
                ul: ({ children }) => (
                  <ul className="mb-2 text-sm text-foreground list-disc list-inside">
                    {children}
                  </ul>
                ),
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">
                    {children}
                  </strong>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
