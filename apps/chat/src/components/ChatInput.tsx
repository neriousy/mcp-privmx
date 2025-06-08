import { Send, Database } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select';
import { cn } from '@/ui/lib/utils';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  selectedModel: string;
  mcpConnected: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onModelChange: (model: string) => void;
  onMcpToggle: () => void;
}

export function ChatInput({
  input,
  isLoading,
  selectedModel,
  mcpConnected,
  onInputChange,
  onSubmit,
  onModelChange,
  onMcpToggle,
}: ChatInputProps) {
  return (
    <div className="p-6">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto">
        <div className="relative">
          <textarea
            value={input}
            onChange={onInputChange}
            placeholder="Ask anything about PrivMX development..."
            className="w-full bg-sidebar-accent rounded-lg px-3 py-2 pr-10 text-sm text-sidebar-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted resize-none"
            rows={1}
            style={{ minHeight: '36px', maxHeight: '200px' }}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as any);
              }
            }}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="sm"
            variant="ghost"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 p-0"
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2 mt-3">
          {/* Model Selection */}
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-32 bg-sidebar-accent hover:bg-muted border-sidebar-border text-xs text-sidebar-foreground h-7">
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent className="bg-sidebar-accent border-sidebar-border">
              <SelectItem
                value="gpt-4o"
                className="text-sidebar-foreground focus:bg-muted"
              >
                GPT-4o
              </SelectItem>
              <SelectItem
                value="gpt-4o-mini"
                className="text-sidebar-foreground focus:bg-muted"
              >
                GPT-4o Mini
              </SelectItem>
            </SelectContent>
          </Select>

          {/* MCP Toggle */}
          <Button
            type="button"
            onClick={onMcpToggle}
            variant={mcpConnected ? 'default' : 'outline'}
            size="sm"
            className={cn('flex items-center gap-1.5 h-7 text-xs')}
          >
            <Database className="w-3 h-3" />
            <span>MCP</span>
            {mcpConnected && (
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
