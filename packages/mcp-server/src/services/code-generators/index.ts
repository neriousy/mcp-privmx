/**
 * Code Generators Index
 * Factory and exports for all language generators
 */

import { BaseCodeGenerator } from './base-generator.js';
import { JavaScriptGenerator } from './javascript-generator.js';
import { JavaGenerator } from './java-generator.js';
import { SwiftGenerator } from './swift-generator.js';
import { CSharpGenerator } from './csharp-generator.js';

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'swift'
  | 'csharp';

/**
 * Factory to create code generators for different languages
 */
export function createCodeGenerator(
  language: SupportedLanguage
): BaseCodeGenerator {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return new JavaScriptGenerator();
    case 'java':
      return new JavaGenerator();
    case 'swift':
      return new SwiftGenerator();
    case 'csharp':
      return new CSharpGenerator();
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return ['javascript', 'typescript', 'java', 'swift', 'csharp'];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(
  language: string
): language is SupportedLanguage {
  return getSupportedLanguages().includes(language as SupportedLanguage);
}

// Export generators for direct use
export {
  BaseCodeGenerator,
  JavaScriptGenerator,
  JavaGenerator,
  SwiftGenerator,
  CSharpGenerator,
};
