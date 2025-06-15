import { JavaScriptGenerator } from './javascript-generator.js';
import { renderTemplate } from './template-renderer.js';

export class TypeScriptGenerator extends JavaScriptGenerator {
  generateSetup(features: string[]): string {
    try {
      return renderTemplate('codegen/typescript/setup.hbs', {
        language: 'typescript',
        features,
      });
    } catch (err) {
      console.warn('[CodeGen] TS template missing, fallback to JS template');
      return super.generateSetup(features);
    }
  }
}
