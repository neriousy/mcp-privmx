'use client';

import { Button } from '@/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/components/ui/card';
import { Badge } from '@/ui/components/ui/badge';
import { Separator } from '@/ui/components/ui/separator';
import { cn } from '@/ui/lib/utils';

export function TestUIComponents() {
  return (
    <div className="p-6 space-y-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>UI Test Component</CardTitle>
          <CardDescription>
            Testing direct import from UI package
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button>Primary Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>

          <div className={cn('p-2 bg-muted rounded', 'border border-border')}>
            <p className="text-sm text-muted-foreground">
              This component uses the cn utility function and design tokens from
              the UI package.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
