import ReactMarkdown from 'react-markdown';
import { Sparkles, FileText, Image as ImageIcon } from 'lucide-react';
import { Message } from 'ai';
import { ToolCallCard } from './ToolCallCard';
import Image from 'next/image';

interface ChatMessageProps {
  message: Message;
}

// Helper function to extract file information from message content
const extractFileInfo = (content: string) => {
  const fileRegex = /--- (.*?) ---\n([\s\S]*?)\n--- End of \1 ---/g;
  const files: Array<{ name: string; content: string }> = [];
  let match;

  while ((match = fileRegex.exec(content)) !== null) {
    files.push({
      name: match[1],
      content: match[2],
    });
  }

  return files;
};

// Helper function to clean content from file information
const cleanContent = (content: string) => {
  // Remove file attachment info
  let cleaned = content.replace(
    /\n\nAttached files:\n[\s\S]*?(?=\n\nFile contents:|$)/,
    ''
  );
  // Remove file contents
  cleaned = cleaned.replace(/\n\nFile contents:[\s\S]*?(?=\n\n(?!---)|$)/, '');
  // Remove individual file blocks
  cleaned = cleaned.replace(
    /--- .*? ---\n[\s\S]*?\n--- End of .*? ---\n?/g,
    ''
  );

  return cleaned.trim();
};

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    const files = extractFileInfo(message.content);
    const cleanedContent = cleanContent(message.content);

    // Get experimental attachments (images) if they exist
    const attachments = message.experimental_attachments || [];
    const imageAttachments = attachments.filter(
      (att) => att.contentType?.startsWith('image/') && att.url
    );

    return (
      <div className="flex">
        <div className="ml-auto max-w-2xl bg-sidebar-accent text-sidebar-foreground rounded-lg px-4 py-3 shadow-sm">
          {/* Main message content */}
          {cleanedContent && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2">
              {cleanedContent}
            </p>
          )}

          {/* Image attachments */}
          {imageAttachments.length > 0 && (
            <div className="space-y-2 border-t border-sidebar-border pt-2 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-sidebar-foreground">
                  {imageAttachments.length} image
                  {imageAttachments.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {imageAttachments.map((attachment, index: number) => (
                  <div key={index} className="bg-sidebar rounded p-2">
                    <div className="text-xs text-muted-foreground mb-2">
                      {attachment.name}
                    </div>
                    <Image
                      src={attachment.url}
                      alt={attachment.name || 'Uploaded image'}
                      className="max-w-full h-auto rounded border max-h-64 object-contain"
                      width={100}
                      height={100}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text file attachments */}
          {files.length > 0 && (
            <div className="space-y-2 border-t border-sidebar-border pt-2 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-sidebar-foreground">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                </span>
              </div>
              {files.map((file, index) => (
                <div key={index} className="bg-sidebar rounded p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-sidebar-foreground">
                      {file.name}
                    </span>
                  </div>
                  <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    <code>
                      {file.content.substring(0, 500)}
                      {file.content.length > 500 ? '...' : ''}
                    </code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
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
