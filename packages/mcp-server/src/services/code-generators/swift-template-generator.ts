import { BaseCodeGenerator } from './base-generator.js';
import { renderTemplate } from './template-renderer.js';

export class SwiftTemplateGenerator extends BaseCodeGenerator {
  generateSetup(features: string[]): string {
    return renderTemplate('codegen/swift/setup.hbs', {
      language: 'swift',
      features,
    });
  }

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
