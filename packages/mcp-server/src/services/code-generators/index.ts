/**
 * Code Generators Index
 * Factory and exports for all language generators
 */

import { BaseCodeGenerator } from './base-generator.js';
import { JavaScriptGenerator } from './javascript-generator.js';
import { JavaTemplateGenerator } from './java-template-generator.js';
import { SwiftTemplateGenerator } from './swift-template-generator.js';
import { CSharpTemplateGenerator } from './csharp-template-generator.js';
import { TypeScriptGenerator } from './typescript-generator.js';
import {
  getCodeGenerator as getPluginGenerator,
  registerCodeGeneratorPlugin,
  getRegisteredLanguages,
} from './plugin-registry.js';

// Register built-in generators as plugins so external callers go through one registry
registerCodeGeneratorPlugin({
  language: 'javascript',
  create: () => new JavaScriptGenerator(),
});
registerCodeGeneratorPlugin({
  language: 'java',
  create: () => new JavaTemplateGenerator(),
});
registerCodeGeneratorPlugin({
  language: 'swift',
  create: () => new SwiftTemplateGenerator(),
});
registerCodeGeneratorPlugin({
  language: 'csharp',
  create: () => new CSharpTemplateGenerator(),
});
registerCodeGeneratorPlugin({
  language: 'typescript',
  create: () => new TypeScriptGenerator(),
});

export type SupportedLanguage = string; // now dynamic based on plugin registry

/**
 * Factory to create code generators for different languages
 */
export function createCodeGenerator(language: string): BaseCodeGenerator {
  // allow external plugins first
  const pluginGen = getPluginGenerator(language);
  if (pluginGen) return pluginGen;

  throw new Error(`Unsupported language: ${language}`);
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
  return getRegisteredLanguages();
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  return getRegisteredLanguages().includes(language.toLowerCase());
}

// Export generators for direct use
export {
  BaseCodeGenerator,
  JavaScriptGenerator,
  JavaTemplateGenerator,
  SwiftTemplateGenerator,
  CSharpTemplateGenerator,
  TypeScriptGenerator,
  registerCodeGeneratorPlugin,
};
