import { z } from 'zod';

export const LanguageSchema = z.enum([
  'javascript',
  'typescript',
  'java',
  'swift',
  'cpp',
  'csharp',
]);

export const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'expert']);

export const FrameworkSchema = z.enum(['react', 'vue', 'vanilla', 'nodejs']);
