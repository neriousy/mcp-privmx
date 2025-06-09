#!/usr/bin/env node

import Handlebars from 'handlebars';
import { promises as fs } from 'fs';

// Register the helpers we need
Handlebars.registerHelper('kebabCase', (str) => {
  return str
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
});

Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('contains', (array, item) => {
  return Array.isArray(array) && array.includes(item);
});

Handlebars.registerHelper('fileExtensions', (language) => {
  return language === 'typescript' ? 'ts,tsx' : 'js,jsx';
});

async function testPackageJson() {
  try {
    // Read the template
    const templateContent = await fs.readFile(
      './src/templates/privmx/secure-chat/package.json.hbs',
      'utf8'
    );
    console.log('Template loaded, length:', templateContent.length);

    // Prepare test data
    const data = {
      appName: 'my-secure-chat',
      language: 'typescript',
      framework: 'react',
      features: ['messaging', 'auth'],
      includeTests: true,
      // Boolean flags for template
      isTypeScript: true,
      isJavaScript: false,
      isReact: true,
      isVue: false,
      isNodejs: false,
      hasMessaging: true,
      hasAuth: true,
      hasFileSharing: false,
      hasNotifications: false,
    };

    console.log('Test data:', JSON.stringify(data, null, 2));

    // Compile and process
    const template = Handlebars.compile(templateContent);
    const result = template(data);

    console.log('\nGenerated package.json:');
    console.log('='.repeat(50));
    console.log(result);
    console.log('='.repeat(50));

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(result);
      console.log('✅ Valid JSON generated');
      console.log('Package name:', parsed.name);
    } catch (error) {
      console.log('❌ Invalid JSON:', error.message);

      // Find the problematic area
      const lines = result.split('\n');
      lines.forEach((line, index) => {
        if (
          line.includes('undefined') ||
          line.includes('{{') ||
          line.includes('}}')
        ) {
          console.log(`Line ${index + 1}: ${line}`);
        }
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPackageJson();
