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

async function testMinimal() {
  try {
    const templateContent = await fs.readFile(
      './minimal-test.json.hbs',
      'utf8'
    );
    console.log('Template content:', templateContent);

    const data = { appName: 'my-secure-chat' };

    const template = Handlebars.compile(templateContent);
    const result = template(data);

    console.log('Generated JSON:', result);

    try {
      const parsed = JSON.parse(result);
      console.log('✅ Valid JSON! Parsed name:', parsed.name);
    } catch (error) {
      console.log('❌ Invalid JSON:', error.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMinimal();
