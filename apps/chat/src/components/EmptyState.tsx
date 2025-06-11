import { MessageSquare } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-background p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-4">
          How can I help you?
        </h1>

        <p className="text-muted-foreground text-lg mb-8">
          I&apos;m here to help you with PrivMX development. I can assist with:
        </p>

        <div className="space-y-3 text-left">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Code Generation</strong> -
              Generate PrivMX code in multiple languages
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">API Discovery</strong> - Find
              and understand PrivMX APIs
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Architecture Design</strong> -
              Build secure applications
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Best Practices</strong> -
              Security and implementation guidance
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mt-8">
          Create a new chat to get started!
        </p>
      </div>
    </div>
  );
}
