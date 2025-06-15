import { BaseCodeGenerator } from './base-generator.js';
import { renderTemplate } from './template-renderer.js';

export class JavaTemplateGenerator extends BaseCodeGenerator {
  generateSetup(features: string[]): string {
    return renderTemplate('codegen/java/setup.hbs', {
      language: 'java',
      features,
    });
  }

  // Template handles implementation
  generateThreadsFeature() {
    return '';
  }
  generateStoresFeature() {
    return '';
  }
  generateInboxesFeature() {
    return '';
  }
  generateCryptoFeature() {
    return '';
  }
  generateThreadsExample() {
    return '';
  }
  generateStoresExample() {
    return '';
  }
  generateInboxesExample() {
    return '';
  }
  generateCryptoExample() {
    return '';
  }
}
