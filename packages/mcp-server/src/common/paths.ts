import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolves paths from the project root (packages/mcp-server/)
export const packageRoot = path.resolve(__dirname, '..', '..');

// Path to the spec directory, assuming it's in the monorepo root
export const specRoot = path.resolve(packageRoot, '..', '..', 'spec');

export const templatesRoot = path.resolve(packageRoot, 'src', 'templates');
