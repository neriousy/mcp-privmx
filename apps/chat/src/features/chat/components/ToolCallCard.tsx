import { useState } from 'react';
import {
  Wrench,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ToolInvocation } from 'ai';

interface ToolCallCardProps {
  toolInvocation: ToolInvocation;
}

export function ToolCallCard({ toolInvocation }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-sidebar-accent rounded p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 mb-2 hover:bg-muted rounded p-1 -m-1 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
          <Wrench className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium text-sidebar-foreground">
            {toolInvocation.toolName}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(toolInvocation.state === 'call' ||
            toolInvocation.state === 'partial-call') && (
            <>
              <Clock className="w-2 h-2 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Calling...</span>
            </>
          )}
          {toolInvocation.state === 'result' && (
            <>
              <CheckCircle className="w-2 h-2 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </>
          )}
        </div>
      </button>

      {/* Tool Details - Only show when expanded */}
      {isExpanded && (
        <div className="space-y-2">
          {/* Tool Arguments */}
          {toolInvocation.args && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Arguments:
              </div>
              <div className="bg-muted rounded p-2 text-xs font-mono">
                <pre className="text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(toolInvocation.args, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Tool Result */}
          {toolInvocation.state === 'result' && 'result' in toolInvocation && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Result:</div>
              <div className="bg-muted rounded p-2 text-xs">
                <div className="text-muted-foreground whitespace-pre-wrap">
                  {typeof toolInvocation.result === 'string'
                    ? toolInvocation.result
                    : JSON.stringify(toolInvocation.result, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
