#!/usr/bin/env node

import { PlopTemplateEngine } from './dist/integrations/plop-template-engine.js';

async function debugTemplate() {
  const templateEngine = new PlopTemplateEngine(
    './src/templates/privmx',
    './test-output'
  );

  const request = {
    templateId: 'secure-chat',
    projectName: 'my-secure-chat',
    framework: 'react',
    language: 'typescript',
    features: ['messaging', 'auth'],
    privmxConfig: {
      solutionId: 'test-solution-123',
      platformUrl: 'https://privmx.cloud',
      apiEndpoints: ['threads'],
    },
    userContext: {
      skillLevel: 'intermediate',
      preferences: {
        includeTests: true,
        includeComments: true,
      },
    },
  };

  const result = await templateEngine.generateFromTemplate(request);

  if (result.success && result.data) {
    const packageJsonFile = result.data.files.find(
      (f) => f.path === 'package.json'
    );
    if (packageJsonFile) {
      console.log('Generated package.json content:');
      console.log('='.repeat(50));
      console.log(packageJsonFile.content);
      console.log('='.repeat(50));

      // Try to find the problematic character
      for (let i = 0; i < packageJsonFile.content.length; i++) {
        const char = packageJsonFile.content[i];
        const charCode = char.charCodeAt(0);
        if (
          charCode < 32 &&
          charCode !== 9 &&
          charCode !== 10 &&
          charCode !== 13
        ) {
          console.log(
            `Found control character at position ${i}: ${charCode} (${char})`
          );
        }
      }
    }
  } else {
    console.log('Generation failed:', result.errors);
  }
}

debugTemplate();
