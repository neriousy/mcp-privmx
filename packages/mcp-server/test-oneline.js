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

async function testOneline() {
  try {
    const templateContent = await fs.readFile(
      './oneline-test.json.hbs',
      'utf8'
    );
    console.log('Template content length:', templateContent.length);
    console.log('Template content:', templateContent);

    const data = { appName: 'my-secure-chat', framework: 'react' };

    const template = Handlebars.compile(templateContent);
    const result = template(data);

    console.log('\nGenerated JSON length:', result.length);
    console.log('Generated JSON:', result);

    try {
      const parsed = JSON.parse(result);
      console.log('\n✅ Valid JSON! Parsed name:', parsed.name);
      console.log('Dependencies:', Object.keys(parsed.dependencies));
    } catch (error) {
      console.log('\n❌ Invalid JSON:', error.message);
      // Show character codes around the error position
      const pos = 71;
      for (let i = pos - 5; i <= pos + 5; i++) {
        const char = result.charAt(i);
        const code = result.charCodeAt(i);
        console.log(`${i}: ${code} "${char}" ${code < 32 ? '(CONTROL)' : ''}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOneline();
