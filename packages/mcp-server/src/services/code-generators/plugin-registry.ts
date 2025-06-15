import { BaseCodeGenerator } from './base-generator.js';
import { readdirSync, statSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';

export interface CodeGeneratorPlugin {
  language: string; // e.g. "ruby", "go"
  create(): BaseCodeGenerator;
}

const registry = new Map<string, () => BaseCodeGenerator>();

const require = createRequire(import.meta.url);

/**
 * Attempt to load external code-generator plugins automatically.
 * Any installed package whose directory name matches
 *   "@privmx/codegen-*"  or  "privmx-codegen-*"
 * is `require`d so that it can register itself.
 *
 * Plugins are expected to call `registerCodeGeneratorPlugin()` during module load.
 */
function autoLoadExternalPlugins(): void {
  const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
  let entries: string[] = [];
  try {
    entries = readdirSync(nodeModulesPath);
  } catch {
    return; // node_modules not present (monorepo w/ pnpm may use .pnpm); skip
  }

  for (const entry of entries) {
    // Handle scoped packages first
    if (entry.startsWith('@privmx')) {
      const scopeDir = path.join(nodeModulesPath, entry);
      for (const pkg of readdirSync(scopeDir)) {
        if (pkg.startsWith('codegen-')) {
          try {
            require(path.join(scopeDir, pkg));
            console.log(`[CodeGen] Loaded external plugin: ${entry}/${pkg}`);
          } catch (err) {
            console.warn(
              `[CodeGen] Failed to load plugin ${entry}/${pkg}:`,
              err
            );
          }
        }
      }
      continue;
    }
    if (
      entry.startsWith('@privmx/codegen-') ||
      entry.startsWith('privmx-codegen-')
    ) {
      const candidatePath = path.join(nodeModulesPath, entry);
      try {
        const stats = statSync(candidatePath);
        if (stats.isDirectory()) {
          require(candidatePath);
          console.log(`[CodeGen] Loaded external plugin: ${entry}`);
        }
      } catch (err) {
        console.warn(`[CodeGen] Failed to load plugin ${entry}:`, err);
      }
    }
  }
}

// Auto-load once at module initialization
autoLoadExternalPlugins();

export function registerCodeGeneratorPlugin(plugin: CodeGeneratorPlugin): void {
  if (registry.has(plugin.language)) {
    console.warn(
      `[CodeGen] Plugin for ${plugin.language} already registered. Overwriting.`
    );
  }
  registry.set(plugin.language.toLowerCase(), plugin.create);
}

export function getCodeGenerator(language: string): BaseCodeGenerator | null {
  const factory = registry.get(language.toLowerCase());
  return factory ? factory() : null;
}

export function getRegisteredLanguages(): string[] {
  return Array.from(registry.keys());
}
