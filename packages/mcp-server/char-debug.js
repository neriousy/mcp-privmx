#!/usr/bin/env node

import Handlebars from 'handlebars';
import { promises as fs } from 'fs';

// Register helpers
Handlebars.registerHelper('kebabCase', (str) => {
  return str
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
});
Handlebars.registerHelper('fileExtensions', (language) => {
  return language === 'typescript' ? 'ts,tsx' : 'js,jsx';
});

async function debugCharacter() {
  try {
    const templateContent = await fs.readFile(
      './src/templates/privmx/secure-chat/package.json.hbs',
      'utf8'
    );

    const data = {
      appName: 'my-secure-chat',
      language: 'typescript',
      framework: 'react',
      features: ['messaging', 'auth'],
      includeTests: true,
      isTypeScript: true,
      isReact: true,
      isVue: false,
      isNodejs: false,
      hasMessaging: true,
      hasAuth: true,
      hasFileSharing: false,
      hasNotifications: false,
    };

    const template = Handlebars.compile(templateContent);
    const result = template(data);

    console.log('Generated JSON length:', result.length);
    console.log(
      'Character at position 70:',
      result.charCodeAt(70),
      `"${result.charAt(70)}"`
    );
    console.log('Characters around position 70:');

    for (let i = 65; i <= 75; i++) {
      const char = result.charAt(i);
      const code = result.charCodeAt(i);
      console.log(`${i}: ${code} "${char}" ${code < 32 ? '(CONTROL)' : ''}`);
    }

    // Also check the first 100 characters
    console.log('\nFirst 100 characters:');
    console.log(result.substring(0, 100));
    console.log('\nCharacter codes for first 100:');
    for (let i = 0; i < Math.min(100, result.length); i++) {
      const code = result.charCodeAt(i);
      if (code < 32 && code !== 10 && code !== 13 && code !== 9) {
        console.log(`Control character at ${i}: ${code}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugCharacter();
