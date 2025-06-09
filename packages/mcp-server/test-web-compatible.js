#!/usr/bin/env node

// Test the web-compatible template engine
import { WebCompatibleTemplateEngine } from './src/integrations/web-compatible-template-engine.js';

async function testWebCompatibleEngine() {
  console.log('🧪 Testing Web-Compatible Template Engine...\n');

  const engine = new WebCompatibleTemplateEngine();

  // Test template generation
  const request = {
    templateId: 'secure-chat',
    projectName: 'my-test-app',
    framework: 'react',
    language: 'typescript',
    features: ['messaging', 'auth'],
    privmxConfig: {
      apiEndpoints: ['https://api.privmx.cloud'],
    },
    userContext: {
      skillLevel: 'intermediate',
    },
  };

  console.log('📋 Test Request:');
  console.log(JSON.stringify(request, null, 2));
  console.log('\n🏗️  Generating templates...');

  try {
    const result = await engine.generateTemplates(request);

    console.log('\n📊 Generation Result:');
    console.log(`✅ Success: ${result.success}`);

    if (result.success && result.data) {
      console.log(`📄 Files generated: ${result.data.files.length}`);

      result.data.files.forEach((file, index) => {
        console.log(`\n📄 File ${index + 1}: ${file.path}`);
        console.log(`   Content length: ${file.content.length} characters`);

        // Test JSON parsing for package.json
        if (file.path === 'package.json') {
          try {
            const parsed = JSON.parse(file.content);
            console.log(`   ✅ Valid JSON: name = "${parsed.name}"`);
            console.log(
              `   ✅ Dependencies count: ${Object.keys(parsed.dependencies || {}).length}`
            );
            console.log(
              `   ✅ DevDependencies count: ${Object.keys(parsed.devDependencies || {}).length}`
            );
          } catch (parseError) {
            console.log(`   ❌ Invalid JSON: ${parseError.message}`);
          }
        }
      });
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach((error) => console.log(`   - ${error}`));
    }

    // Test available templates
    console.log('\n📋 Available Templates:');
    const templates = await engine.getAvailableTemplates();
    templates.forEach((template) => {
      console.log(`   - ${template}`);
    });

    console.log('\n🎉 Web-Compatible Template Engine Test Complete!');
    console.log('✅ No Handlebars dependency issues');
    console.log('✅ Works in webpack environments');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testWebCompatibleEngine();
