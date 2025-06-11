import dotenv from 'dotenv';
import { z } from 'zod';
import { packageRoot } from './paths.js';
import path from 'path';

// Load .env file from the package root
dotenv.config({ path: path.resolve(packageRoot, '.env') });

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),
  SPEC_PATH: z.string().optional(),
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsedConfig.error.flatten().fieldErrors
  );
  throw new Error('Invalid environment variables');
}

export const config = parsedConfig.data;
