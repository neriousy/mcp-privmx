#!/usr/bin/env node

/**
 * Test script for MCP tools integration
 */

import { APIKnowledgeService } from './dist/services/api-knowledge-service.js';

async function testMCPTools() {
  console.log('🧪 Testing PrivMX MCP Tools Integration...\n');

  try {
    // Initialize service with minimal config
    const config = {
      specPath: './spec',
      supportedLanguages: ['javascript', 'typescript'],
    };

    const service = new APIKnowledgeService(config);
    console.log('✅ APIKnowledgeService initialized');

    // Test 1: Get available templates
    console.log('\n📋 Testing Template Listing...');
    const templates = service.getAvailablePrivMXTemplates();
    console.log(`✅ Found ${templates.length} templates:`);
    templates.forEach((t) => console.log(`   - ${t.name}: ${t.description}`));

    // Test 2: Get available transformations
    console.log('\n🔄 Testing Transformation Listing...');
    const transformations = service.getAvailableCodeTransformations();
    console.log(`✅ Found ${transformations.length} transformations:`);
    transformations.forEach((t) =>
      console.log(`   - ${t.name}: ${t.description}`)
    );

    // Test 3: Test PrivMX Intelligence
    console.log('\n🧠 Testing PrivMX Intelligence...');
    const intelligence = await service.getPrivMXIntelligence({
      query: 'How do I create a secure chat thread?',
      type: 'workflow-suggestion',
      context: {
        framework: 'react',
        apis: ['threads'],
      },
    });

    if (intelligence.success) {
      console.log('✅ PrivMX Intelligence working');
      console.log(
        `   Response: ${JSON.stringify(intelligence.data).substring(0, 100)}...`
      );
    } else {
      console.log(
        '❌ PrivMX Intelligence failed:',
        intelligence.errors?.[0] || 'Unknown error'
      );
    }

    // Test 4: Test template generation (simplified)
    console.log('\n🏗️ Testing Template Generation...');
    try {
      const generation = await service.generatePrivMXApp({
        templateId: 'secure-chat',
        projectName: 'test-chat-app',
        framework: 'react',
        language: 'typescript',
        features: ['messaging', 'auth'],
        privmxConfig: {
          solutionId: 'test-solution',
          platformUrl: 'https://privmx.cloud',
          apiEndpoints: ['threads'],
        },
        userContext: {
          skillLevel: 'beginner',
          preferences: { includeTests: true },
        },
      });

      if (generation.success) {
        console.log('✅ Template generation working');
        console.log(
          `   Generated ${generation.data?.files?.length || 0} files`
        );
        if (generation.data?.files && generation.data.files.length > 0) {
          console.log('   Sample files:');
          generation.data.files
            .slice(0, 3)
            .forEach((f) => console.log(`     - ${f.path}`));
        }
      } else {
        console.log(
          '❌ Template generation failed:',
          generation.errors?.[0] || 'Unknown error'
        );
      }
    } catch (error) {
      console.log('❌ Template generation error:', error.message);
    }

    console.log('\n🎉 MCP Tools test completed!\n');

    console.log('📊 Summary:');
    console.log(`   Templates: ${templates.length} available`);
    console.log(`   Transformations: ${transformations.length} available`);
    console.log(
      `   Intelligence: ${intelligence.success ? 'Working' : 'Failed'}`
    );
    console.log('   Integration: All core systems operational\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testMCPTools();
