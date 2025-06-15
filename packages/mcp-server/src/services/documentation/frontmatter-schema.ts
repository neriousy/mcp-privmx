import { z } from 'zod';

export const FrontmatterSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  language: z
    .enum(['javascript', 'typescript', 'java', 'swift', 'cpp', 'csharp'])
    .optional(),
  framework: z.enum(['react', 'vue', 'vanilla', 'nodejs']).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  tags: z.array(z.string()).optional(),
  category: z
    .enum([
      'tutorial',
      'concept',
      'guide',
      'api',
      'getting-started',
      'documentation',
    ])
    .optional(),
  namespace: z.string().optional(),
});
