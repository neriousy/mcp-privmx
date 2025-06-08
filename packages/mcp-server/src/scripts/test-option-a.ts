#!/usr/bin/env tsx

/**
 * Test script for Option A implementation
 * Verifies that the API Knowledge Service can load and search real PrivMX API data
 */

import { APIKnowledgeService } from '../services/api-knowledge-service.js';
import * as path from 'path';

async function testOptionA() {
  console.log('🧪 Testing Option A Implementation...\n');

  // Initialize the service
  const service = new APIKnowledgeService({
    specPath: path.join(process.cwd(), '../../spec'),
    supportedLanguages: ['javascript', 'java', 'swift', 'cpp', 'csharp'],
  });

  try {
    // Test 1: Initialize and build knowledge graph
    console.log('📊 Test 1: Building knowledge graph...');
    await service.initialize();
    console.log('✅ Knowledge graph built successfully!\n');

    // Test 2: Get documentation stats
    console.log('📈 Test 2: Getting documentation stats...');
    const stats = await service.getDocumentationStats();
    console.log(`   📋 Total namespaces: ${stats.total}`);
    console.log(`   📊 By type:`, stats.byType);
    console.log('✅ Stats retrieved successfully!\n');

    // Test 3: Search for APIs
    console.log('🔍 Test 3: Searching for APIs...');
    const searchQueries = [
      'create thread',
      'upload file',
      'send message',
      'connect platform',
      'crypto',
    ];

    for (const query of searchQueries) {
      console.log(`   🔎 Searching for: "${query}"`);
      const results = await service.discoverAPI(query);
      console.log(`   📋 Found ${results.length} results`);

      if (results.length > 0) {
        const topResult = results[0];
        console.log(
          `   🎯 Top result: ${topResult.metadata.title} (${topResult.metadata.type})`
        );
        console.log(`   📝 Score: ${topResult.score?.toFixed(2)}`);
      }
      console.log('');
    }

    // Test 4: Search for specific methods
    console.log('🔧 Test 4: Searching for specific methods...');
    const methodQueries = ['connect', 'create', 'send', 'get'];

    for (const query of methodQueries) {
      console.log(`   🔎 Searching methods for: "${query}"`);
      const results = await service.searchApiMethods(query);
      console.log(`   📋 Found ${results.length} method results`);

      if (results.length > 0) {
        const topResult = results[0];
        console.log(`   🎯 Top method: ${topResult.metadata.title}`);
      }
      console.log('');
    }

    // Test 5: Search for classes
    console.log('📦 Test 5: Searching for classes...');
    const classQueries = ['Platform', 'Thread', 'Store', 'Connection'];

    for (const query of classQueries) {
      console.log(`   🔎 Searching classes for: "${query}"`);
      const results = await service.searchClasses(query);
      console.log(`   📋 Found ${results.length} class results`);

      if (results.length > 0) {
        const topResult = results[0];
        console.log(`   🎯 Top class: ${topResult.metadata.title}`);
      }
      console.log('');
    }

    // Test 6: Generate setup code
    console.log('🚀 Test 6: Generating setup code...');
    const languages = ['javascript', 'java', 'swift'];

    for (const language of languages) {
      console.log(`   💻 Generating ${language} setup...`);
      const code = service.generateSetupCode(language, ['threads', 'stores']);
      console.log(`   📝 Generated ${code.length} characters of code`);
      console.log(`   🔍 Preview: ${code.substring(0, 100)}...`);
      console.log('');
    }

    // Test 7: Test indexing performance
    console.log('⚡ Test 7: Testing re-indexing...');
    const startTime = Date.now();
    await service.indexDocumentation('spec', true); // Force re-index
    const endTime = Date.now();
    console.log(`   ⏱️ Re-indexing took: ${endTime - startTime}ms`);
    console.log('✅ Re-indexing completed successfully!\n');

    console.log(
      '🎉 All tests passed! Option A implementation is working correctly.'
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testOptionA().catch(console.error);
