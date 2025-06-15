import { z } from 'zod';

export const LanguageSchema = z.enum([
  'javascript',
  'typescript',
  'java',
  'swift',
  'cpp',
  'csharp',
]);

export const SkillLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
]);

export const FrameworkSchema = z.enum(['react', 'vue', 'vanilla', 'nodejs']);

export const FeatureSchema = z.enum(['threads', 'stores', 'inboxes', 'crypto']);
