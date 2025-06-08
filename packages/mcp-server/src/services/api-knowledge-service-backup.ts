/**
 * API Knowledge Service - Option A Implementation
 *
 * This service builds an in-memory knowledge graph from PrivMX APIs
 * and provides fast, deterministic search and code generation capabilities.
 *
 * No vector embeddings or semantic search - just structured data lookup.
 */

import { APIParser } from '../api/parser.js';
import { APINamespace, APIMethod, APIClass } from '../api/types.js';
import { DocumentProcessor } from '../loaders/document-processor.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SearchResult {
  id: string;
  content: string;
  metadata: {
    type: string;
    namespace?: string;
    title?: string;
    path?: string;
    language?: string;
    methodType?: string;
    className?: string;
  };
  score?: number;
}

export interface CodeGenerationOptions {
  language: string;
  features?: string[];
  className?: string;
  methodName?: string;
  includeImports?: boolean;
  includeErrorHandling?: boolean;
}

export interface APIKnowledgeServiceConfig {
  specPath: string;
  supportedLanguages: string[];
}

/**
 * In-memory API knowledge graph
 */
export class APIKnowledgeService {
  private config: APIKnowledgeServiceConfig;
  private apiParser: APIParser;
  private documentProcessor: DocumentProcessor;
  private initialized = false;

  // In-memory knowledge stores
  private apiIndex: Map<string, APINamespace> = new Map();
  private methodIndex: Map<string, APIMethod[]> = new Map();
  private classIndex: Map<string, APIClass[]> = new Map();
  private languageIndex: Map<string, APINamespace[]> = new Map();
  private keywordIndex: Map<string, SearchResult[]> = new Map();

  constructor(config: APIKnowledgeServiceConfig) {
    this.config = config;
    this.apiParser = new APIParser();
    this.documentProcessor = new DocumentProcessor();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🏗️ Building API knowledge graph...');

    try {
      await this.buildKnowledgeGraph();
      this.buildSearchIndices();
      this.initialized = true;

      console.log('✅ API knowledge graph ready!');
      console.log(`   📊 ${this.apiIndex.size} namespaces indexed`);
      console.log(`   🔧 ${this.getTotalMethods()} methods indexed`);
      console.log(`   📋 ${this.getTotalClasses()} classes indexed`);
      console.log(`   🌍 ${this.languageIndex.size} languages supported`);
    } catch (error) {
      console.error('❌ Failed to build knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Build the knowledge graph from API specifications
   */
  private async buildKnowledgeGraph(): Promise<void> {
    const specPath = this.config.specPath || 'spec';

    // Find all JSON API files
    const apiFiles = await this.findAPIFiles(specPath);

    for (const apiFile of apiFiles) {
      try {
        console.log(`   📄 Processing: ${apiFile}`);

        // Determine language from file path
        const language = this.extractLanguageFromPath(apiFile);

        // Load and parse the API file
        const content = await fs.readFile(apiFile, 'utf-8');
        const namespaces = await this.apiParser.parseAPISpec(
          content,
          language,
          apiFile
        );

        // Store in knowledge graph
        for (const namespace of namespaces) {
          const key = `${language}:${namespace.name}`;
          this.apiIndex.set(key, namespace);

          // Add to language index
          if (!this.languageIndex.has(language)) {
            this.languageIndex.set(language, []);
          }
          this.languageIndex.get(language)!.push(namespace);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to process ${apiFile}:`, error);
      }
    }
  }

  /**
   * Build search indices for fast lookup
   */
  private buildSearchIndices(): void {
    console.log('   🔍 Building search indices...');

    for (const [key, namespace] of this.apiIndex) {
      const [language] = key.split(':');

      // Index methods
      for (const method of namespace.functions) {
        this.indexMethod(method, language, namespace.name);
      }

      // Index class methods
      for (const apiClass of namespace.classes) {
        this.indexClass(apiClass, language, namespace.name);

        for (const method of apiClass.methods) {
          this.indexMethod(method, language, namespace.name, apiClass.name);
        }

        for (const method of apiClass.staticMethods) {
          this.indexMethod(method, language, namespace.name, apiClass.name);
        }

        for (const constructor of apiClass.constructors) {
          this.indexMethod(
            constructor,
            language,
            namespace.name,
            apiClass.name
          );
        }
      }
    }
  }

  /**
   * Index a method for search
   */
  private indexMethod(
    method: APIMethod,
    language: string,
    namespace: string,
    className?: string
  ): void {
    const key = method.name.toLowerCase();

    if (!this.methodIndex.has(key)) {
      this.methodIndex.set(key, []);
    }

    this.methodIndex.get(key)!.push(method);

    // Add to keyword index
    const searchResult: SearchResult = {
      id: `method:${language}:${namespace}:${className || ''}:${method.name}`,
      content: this.formatMethodForSearch(method, className),
      metadata: {
        type: 'method',
        namespace,
        language,
        title: `${method.name}${className ? ` (${className})` : ''}`,
        methodType: method.methodType,
        className,
      },
      score: 1.0,
    };

    this.addToKeywordIndex(method.name, searchResult);
    this.addToKeywordIndex(method.description, searchResult);

    if (className) {
      this.addToKeywordIndex(className, searchResult);
    }
  }

  /**
   * Index a class for search
   */
  private indexClass(
    apiClass: APIClass,
    language: string,
    namespace: string
  ): void {
    const key = apiClass.name.toLowerCase();

    if (!this.classIndex.has(key)) {
      this.classIndex.set(key, []);
    }

    this.classIndex.get(key)!.push(apiClass);

    // Add to keyword index
    const searchResult: SearchResult = {
      id: `class:${language}:${namespace}:${apiClass.name}`,
      content: this.formatClassForSearch(apiClass),
      metadata: {
        type: 'class',
        namespace,
        language,
        title: apiClass.name,
        className: apiClass.name,
      },
      score: 1.0,
    };

    this.addToKeywordIndex(apiClass.name, searchResult);
    this.addToKeywordIndex(apiClass.description, searchResult);
  }

  /**
   * Add result to keyword index
   */
  private addToKeywordIndex(text: string, result: SearchResult): void {
    if (!text || typeof text !== 'string') {
      return; // Skip if text is undefined, null, or not a string
    }

    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
      if (word.length < 3) continue; // Skip short words

      if (!this.keywordIndex.has(word)) {
        this.keywordIndex.set(word, []);
      }

      this.keywordIndex.get(word)!.push(result);
    }
  }

  /**
   * Search for APIs by functionality description
   */
  async discoverAPI(
    functionality: string,
    language?: string
  ): Promise<SearchResult[]> {
    const words = functionality.toLowerCase().split(/\s+/);
    const results = new Map<string, SearchResult>();
    const scores = new Map<string, number>();

    for (const word of words) {
      if (word.length < 3) continue;

      const matches = this.keywordIndex.get(word) || [];

      for (const match of matches) {
        if (language && match.metadata.language !== language) continue;

        const id = match.id;
        if (!results.has(id)) {
          results.set(id, match);
          scores.set(id, 0);
        }

        scores.set(id, scores.get(id)! + 1);
      }
    }

    // Convert to array and sort by relevance
    const sortedResults = Array.from(results.values())
      .map((result) => ({
        ...result,
        score: scores.get(result.id)! / words.length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return sortedResults;
  }

  /**
   * Generate setup code for PrivMX connection
   */
  async generateSetup(
    language: string,
    features: string[] = []
  ): Promise<string> {
    // This is a basic implementation - will be expanded
    const templates = {
      javascript: this.generateJavaScriptSetup(features),
      typescript: this.generateTypeScriptSetup(features),
      java: this.generateJavaSetup(features),
      swift: this.generateSwiftSetup(features),
      cpp: this.generateCppSetup(features),
      csharp: this.generateCSharpSetup(features),
    };

    return (
      templates[language as keyof typeof templates] ||
      `// Setup code for ${language} not yet implemented`
    );
  }

  /**
   * Generate workflow code
   */
  async generateWorkflow(
    workflow: string,
    language: string,
    options: CodeGenerationOptions = { language }
  ): Promise<string> {
    // Basic workflow templates - will be expanded
    const workflows = {
      'secure-messaging': this.generateSecureMessagingWorkflow(
        language,
        options
      ),
      'file-sharing': this.generateFileSharingWorkflow(language, options),
      'data-storage': this.generateDataStorageWorkflow(language, options),
    };

    return (
      workflows[workflow as keyof typeof workflows] ||
      `// Workflow ${workflow} for ${language} not yet implemented`
    );
  }

  // Helper methods for formatting search results
  private formatMethodForSearch(method: APIMethod, className?: string): string {
    const prefix = className ? `${className}.` : '';
    const params = method.parameters
      .map((p) => `${p.name}: ${p.type.name}`)
      .join(', ');
    const returns =
      method.returns.length > 0 ? ` -> ${method.returns[0].type.name}` : '';

    return `${prefix}${method.name}(${params})${returns}\n\n${method.description}`;
  }

  private formatClassForSearch(apiClass: APIClass): string {
    const methodCount =
      apiClass.methods.length +
      apiClass.staticMethods.length +
      apiClass.constructors.length;
    return `class ${apiClass.name}\n\n${apiClass.description}\n\nMethods: ${methodCount}`;
  }

  // Language-specific code generation methods (enhanced for production)
  private generateJavaScriptSetup(features: string[]): string {
    const hasThreads = features.includes('threads');
    const hasStores = features.includes('stores');
    const hasInboxes = features.includes('inboxes');
    const hasCrypto = features.includes('crypto');

    const imports = [
      "import { Endpoint } from '@privmx/privmx-webendpoint-sdk';",
    ];

    if (hasThreads) imports.push('// Threads for secure messaging');
    if (hasStores) imports.push('// Stores for encrypted file sharing');
    if (hasInboxes) imports.push('// Inboxes for anonymous submissions');
    if (hasCrypto) imports.push('// Crypto for key management');

    const setupCode = `
/**
 * PrivMX WebEndpoint Setup - Production Ready
 * Generated by PrivMX MCP Server
 */

${imports.join('\n')}

class PrivMXManager {
  constructor() {
    this.endpoint = null;
    this.connectionId = null;
    this.isConnected = false;
  }

  /**
   * Initialize PrivMX WebAssembly and connect to Bridge
   */
  async initialize(config) {
    try {
      // Setup WebAssembly assets (required for crypto operations)
      await Endpoint.setup('/path/to/privmx-webendpoint-assets/');
      
      // Create endpoint instance
      this.endpoint = new Endpoint();
      
      // Connect to PrivMX Bridge
      this.connectionId = await this.endpoint.connect({
        userPrivKey: config.userPrivateKey,
        solutionId: config.solutionId,
        platformUrl: config.bridgeUrl || 'https://your-bridge.privmx.dev'
      });
      
      this.isConnected = true;
      console.log('✅ Connected to PrivMX Bridge:', this.connectionId);
      
      return this.connectionId;
    } catch (error) {
      console.error('❌ PrivMX initialization failed:', error);
      throw new Error(\`PrivMX setup failed: \${error.message}\`);
    }
  }${hasThreads ? this.generateThreadsFeature() : ''}${hasStores ? this.generateStoresFeature() : ''}${hasInboxes ? this.generateInboxesFeature() : ''}${hasCrypto ? this.generateCryptoFeature() : ''}

  /**
   * Cleanup and disconnect
   */
  async disconnect() {
    try {
      if (this.endpoint && this.connectionId) {
        await this.endpoint.disconnect(this.connectionId);
        this.isConnected = false;
        console.log('✅ Disconnected from PrivMX Bridge');
      }
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  }

  /**
   * Check connection status
   */
  isReady() {
    return this.isConnected && this.endpoint && this.connectionId;
  }
}

// Usage Example
async function main() {
  const privmx = new PrivMXManager();
  
  try {
    await privmx.initialize({
      userPrivateKey: 'YOUR_PRIVATE_KEY_WIF',
      solutionId: 'YOUR_SOLUTION_ID',
      bridgeUrl: 'https://your-bridge.privmx.dev'
    });
    
    ${hasThreads ? this.generateThreadsExample() : ''}${hasStores ? this.generateStoresExample() : ''}${hasInboxes ? this.generateInboxesExample() : ''}${hasCrypto ? this.generateCryptoExample() : ''}
  } catch (error) {
    console.error('Application error:', error);
  } finally {
    await privmx.disconnect();
  }
}

// Uncomment to run
// main().catch(console.error);

export { PrivMXManager };`;

    return setupCode;
  }

  private generateTypeScriptSetup(features: string[]): string {
    const hasThreads = features.includes('threads');
    const hasStores = features.includes('stores');
    const hasInboxes = features.includes('inboxes');
    const hasCrypto = features.includes('crypto');

    const imports = [
      "import { Endpoint } from '@privmx/privmx-webendpoint-sdk';",
    ];

    if (hasThreads) imports.push('// Threads for secure messaging');
    if (hasStores) imports.push('// Stores for encrypted file sharing');
    if (hasInboxes) imports.push('// Inboxes for anonymous submissions');
    if (hasCrypto) imports.push('// Crypto for key management');

    const setupCode = `
/**
 * PrivMX WebEndpoint Setup - TypeScript Production Ready
 * Generated by PrivMX MCP Server
 */

${imports.join('\n')}

interface PrivMXConfig {
  userPrivateKey: string;
  solutionId: string;
  bridgeUrl?: string;
}

interface User {
  userId: string;
  pubKey: string;
}

class PrivMXManager {
  private endpoint: Endpoint | null = null;
  private connectionId: string | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize PrivMX WebAssembly and connect to Bridge
   */
  async initialize(config: PrivMXConfig): Promise<string> {
    try {
      // Setup WebAssembly assets (required for crypto operations)
      await Endpoint.setup('/path/to/privmx-webendpoint-assets/');
      
      // Create endpoint instance
      this.endpoint = new Endpoint();
      
      // Connect to PrivMX Bridge
      this.connectionId = await this.endpoint.connect({
        userPrivKey: config.userPrivateKey,
        solutionId: config.solutionId,
        platformUrl: config.bridgeUrl || 'https://your-bridge.privmx.dev'
      });
      
      this.isConnected = true;
      console.log('✅ Connected to PrivMX Bridge:', this.connectionId);
      
      return this.connectionId;
    } catch (error) {
      console.error('❌ PrivMX initialization failed:', error);
      throw new Error(\`PrivMX setup failed: \${(error as Error).message}\`);
    }
  }${hasThreads ? this.generateThreadsFeature() : ''}${hasStores ? this.generateStoresFeature() : ''}${hasInboxes ? this.generateInboxesFeature() : ''}${hasCrypto ? this.generateCryptoFeature() : ''}

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    try {
      if (this.endpoint && this.connectionId) {
        await this.endpoint.disconnect(this.connectionId);
        this.isConnected = false;
        console.log('✅ Disconnected from PrivMX Bridge');
      }
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  }

  /**
   * Check connection status
   */
  isReady(): boolean {
    return this.isConnected && this.endpoint !== null && this.connectionId !== null;
  }
}

// Usage Example
async function main(): Promise<void> {
  const privmx = new PrivMXManager();
  
  try {
    await privmx.initialize({
      userPrivateKey: 'YOUR_PRIVATE_KEY_WIF',
      solutionId: 'YOUR_SOLUTION_ID',
      bridgeUrl: 'https://your-bridge.privmx.dev'
    });
    
    ${hasThreads ? this.generateThreadsExample() : ''}${hasStores ? this.generateStoresExample() : ''}${hasInboxes ? this.generateInboxesExample() : ''}${hasCrypto ? this.generateCryptoExample() : ''}
  } catch (error) {
    console.error('Application error:', error);
  } finally {
    await privmx.disconnect();
  }
}

// Uncomment to run
// main().catch(console.error);

export { PrivMXManager, type PrivMXConfig, type User };`;

    return setupCode;
  }

  private generateJavaSetup(features: string[]): string {
    const hasThreads = features.includes('threads');
    const hasStores = features.includes('stores');
    const hasInboxes = features.includes('inboxes');
    const hasCrypto = features.includes('crypto');

    const imports = [
      'import com.simplito.java.privmx_endpoint.*;',
      'import com.simplito.java.privmx_endpoint.model.*;',
      'import java.util.*;',
      'import java.nio.charset.StandardCharsets;',
    ];

    if (hasThreads) imports.push('// Threads for secure messaging');
    if (hasStores) imports.push('// Stores for encrypted file sharing');
    if (hasInboxes) imports.push('// Inboxes for anonymous submissions');
    if (hasCrypto) imports.push('// Crypto for key management');

    const setupCode = `
/**
 * PrivMX Endpoint Setup - Java Production Ready
 * Generated by PrivMX MCP Server
 * 
 * Requirements:
 * - Add privmx-endpoint-java dependency to your pom.xml/build.gradle
 * - Include native libraries in java.library.path
 */

${imports.join('\n')}

public class PrivMXManager {
    private PrivmxEndpoint endpoint;
    private long connectionId;
    private boolean isConnected = false;

    /**
     * Initialize PrivMX and connect to Bridge
     */
    public long initialize(String userPrivateKey, String solutionId, String bridgeUrl) 
            throws Exception {
        try {
            // Create endpoint instance
            this.endpoint = new PrivmxEndpoint();
            
            // Connect to PrivMX Bridge
            this.connectionId = endpoint.connect(
                userPrivateKey,
                solutionId,
                bridgeUrl != null ? bridgeUrl : "https://your-bridge.privmx.dev"
            );
            
            this.isConnected = true;
            System.out.println("✅ Connected to PrivMX Bridge: " + connectionId);
            
            return connectionId;
        } catch (Exception error) {
            System.err.println("❌ PrivMX initialization failed: " + error.getMessage());
            throw new Exception("PrivMX setup failed: " + error.getMessage());
        }
    }${hasThreads ? this.generateJavaThreadsFeature() : ''}${hasStores ? this.generateJavaStoresFeature() : ''}${hasInboxes ? this.generateJavaInboxesFeature() : ''}${hasCrypto ? this.generateJavaCryptoFeature() : ''}

    /**
     * Cleanup and disconnect
     */
    public void disconnect() {
        try {
            if (endpoint != null && isConnected) {
                endpoint.disconnect(connectionId);
                isConnected = false;
                System.out.println("✅ Disconnected from PrivMX Bridge");
            }
        } catch (Exception error) {
            System.err.println("❌ Disconnect failed: " + error.getMessage());
        }
    }

    /**
     * Check connection status
     */
    public boolean isReady() {
        return isConnected && endpoint != null;
    }

    /**
     * Usage Example
     */
    public static void main(String[] args) {
        PrivMXManager privmx = new PrivMXManager();
        
        try {
            privmx.initialize(
                "YOUR_PRIVATE_KEY_WIF",
                "YOUR_SOLUTION_ID", 
                "https://your-bridge.privmx.dev"
            );
            
            ${hasThreads ? this.generateJavaThreadsExample() : ''}${hasStores ? this.generateJavaStoresExample() : ''}${hasInboxes ? this.generateJavaInboxesExample() : ''}${hasCrypto ? this.generateJavaCryptoExample() : ''}
        } catch (Exception error) {
            System.err.println("Application error: " + error.getMessage());
        } finally {
            privmx.disconnect();
        }
    }
}`;

    return setupCode;
  }

  private generateSwiftSetup(features: string[]): string {
    const hasThreads = features.includes('threads');
    const hasStores = features.includes('stores');
    const hasInboxes = features.includes('inboxes');
    const hasCrypto = features.includes('crypto');

    const imports = [
      'import PrivMXEndpointSwift',
      'import PrivMXEndpointSwiftExtra',
      'import PrivMXEndpointSwiftNative',
      'import Foundation',
    ];

    if (hasThreads) imports.push('// Threads for secure messaging');
    if (hasStores) imports.push('// Stores for encrypted file sharing');
    if (hasInboxes) imports.push('// Inboxes for anonymous submissions');
    if (hasCrypto) imports.push('// Crypto for key management');

    const setupCode = `
/**
 * PrivMX Endpoint Setup - Swift Production Ready
 * Generated by PrivMX MCP Server
 * 
 * Requirements:
 * - Add PrivMXEndpointSwiftExtra to your project
 * - Configure app capabilities for network access
 */

${imports.join('\n')}

struct PrivMXConfig {
    let userPrivateKey: String
    let solutionId: String
    let bridgeUrl: String
}

struct User {
    let userId: String
    let pubKey: String
}

class PrivMXManager {
    private var endpointContainer: PrivmxEndpointContainer?
    private var endpointSession: PrivmxEndpoint?
    private var isConnected: Bool = false
    
    /**
     * Initialize PrivMX and connect to Bridge
     */
    func initialize(config: PrivMXConfig) async throws -> PrivmxEndpoint {
        do {
            // Create endpoint container
            endpointContainer = PrivmxEndpointContainer()
            
            // Set certificates path if needed
            // endpointContainer?.setCertsPath("path/to/certs")
            
            // Connect to PrivMX Bridge
            let modules: Set<Modules> = [${hasThreads ? '.THREAD' : ''}${hasStores ? (hasThreads ? ', .STORE' : '.STORE') : ''}${hasInboxes ? (hasThreads || hasStores ? ', .INBOX' : '.INBOX') : ''}]
            
            guard let session = try endpointContainer?.connect(
                modules,
                config.userPrivateKey,
                config.solutionId,
                config.bridgeUrl
            ) else {
                throw PrivMXError.initializationFailed("Failed to create endpoint session")
            }
            
            self.endpointSession = session
            self.isConnected = true
            
            print("✅ Connected to PrivMX Bridge")
            return session
        } catch {
            print("❌ PrivMX initialization failed: \\(error)")
            throw PrivMXError.initializationFailed("PrivMX setup failed: \\(error.localizedDescription)")
        }
    }${hasThreads ? this.generateSwiftThreadsFeature() : ''}${hasStores ? this.generateSwiftStoresFeature() : ''}${hasInboxes ? this.generateSwiftInboxesFeature() : ''}${hasCrypto ? this.generateSwiftCryptoFeature() : ''}
    
    /**
     * Cleanup and disconnect
     */
    func disconnect() async {
        do {
            if let session = endpointSession, isConnected {
                try session.disconnect()
                isConnected = false
                print("✅ Disconnected from PrivMX Bridge")
            }
        } catch {
            print("❌ Disconnect failed: \\(error)")
        }
    }
    
    /**
     * Check connection status
     */
    func isReady() -> Bool {
        return isConnected && endpointSession != nil
    }
}

enum PrivMXError: Error {
    case initializationFailed(String)
    case notInitialized
    case operationFailed(String)
    
    var localizedDescription: String {
        switch self {
        case .initializationFailed(let message):
            return "Initialization failed: \\(message)"
        case .notInitialized:
            return "PrivMX not initialized"
        case .operationFailed(let message):
            return "Operation failed: \\(message)"
        }
    }
}

// Usage Example
class PrivMXApp {
    private let privmx = PrivMXManager()
    
    func main() async {
        do {
            let config = PrivMXConfig(
                userPrivateKey: "YOUR_PRIVATE_KEY_WIF",
                solutionId: "YOUR_SOLUTION_ID",
                bridgeUrl: "https://your-bridge.privmx.dev"
            )
            
            let session = try await privmx.initialize(config: config)
            
            ${hasThreads ? this.generateSwiftThreadsExample() : ''}${hasStores ? this.generateSwiftStoresExample() : ''}${hasInboxes ? this.generateSwiftInboxesExample() : ''}${hasCrypto ? this.generateSwiftCryptoExample() : ''}
        } catch {
            print("Application error: \\(error)")
        }
        
        await privmx.disconnect()
    }
}

// Uncomment to run
// Task {
//     await PrivMXApp().main()
// }`;

    return setupCode;
  }

  private generateCppSetup(features: string[]): string {
    return `// C++ PrivMX Setup
// Implementation coming soon`;
  }

  private generateCSharpSetup(features: string[]): string {
    const hasThreads = features.includes('threads');
    const hasStores = features.includes('stores');
    const hasInboxes = features.includes('inboxes');
    const hasCrypto = features.includes('crypto');

    const usings = [
      'using Privmx.Endpoint;',
      'using Privmx.Endpoint.Core;',
      'using System;',
      'using System.Collections.Generic;',
      'using System.Text;',
      'using System.Text.Json;',
      'using System.Threading.Tasks;',
    ];

    if (hasThreads) usings.push('using Privmx.Endpoint.Thread;');
    if (hasStores) usings.push('using Privmx.Endpoint.Store;');
    if (hasInboxes) usings.push('using Privmx.Endpoint.Inbox;');
    if (hasCrypto) usings.push('using Privmx.Endpoint.Crypto;');

    const setupCode = `
/**
 * PrivMX Endpoint Setup - C# Production Ready
 * Generated by PrivMX MCP Server
 * 
 * Requirements:
 * - Add Privmx.Endpoint NuGet package to your project
 * - Configure native library loading for your platform
 */

${usings.join('\n')}

namespace PrivMXIntegration
{
    public class PrivMXConfig
    {
        public string UserPrivateKey { get; set; }
        public string SolutionId { get; set; }
        public string BridgeUrl { get; set; } = "https://your-bridge.privmx.dev";
    }

    public class User
    {
        public string UserId { get; set; }
        public string PubKey { get; set; }
    }

    public enum PrivMXError
    {
        InitializationFailed,
        NotInitialized,
        OperationFailed
    }

    public class PrivMXException : Exception
    {
        public PrivMXError ErrorType { get; }

        public PrivMXException(PrivMXError errorType, string message) : base(message)
        {
            ErrorType = errorType;
        }

        public PrivMXException(PrivMXError errorType, string message, Exception innerException) 
            : base(message, innerException)
        {
            ErrorType = errorType;
        }
    }

    public class PrivMXManager : IDisposable
    {
        private Connection _connection;
        private long _connectionId;
        private bool _isConnected = false;
        private bool _disposed = false;

        /**
         * Initialize PrivMX and connect to Bridge
         */
        public async Task<long> InitializeAsync(PrivMXConfig config)
        {
            try
            {
                // Create connection
                _connection = new Connection();

                // Connect to PrivMX Bridge
                _connectionId = await Task.Run(() => _connection.Connect(
                    config.UserPrivateKey,
                    config.SolutionId,
                    config.BridgeUrl
                ));

                _isConnected = true;
                Console.WriteLine($"✅ Connected to PrivMX Bridge: {_connectionId}");

                return _connectionId;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PrivMX initialization failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.InitializationFailed, 
                    $"PrivMX setup failed: {ex.Message}", ex);
            }
        }${hasThreads ? this.generateCSharpThreadsFeature() : ''}${hasStores ? this.generateCSharpStoresFeature() : ''}${hasInboxes ? this.generateCSharpInboxesFeature() : ''}${hasCrypto ? this.generateCSharpCryptoFeature() : ''}

        /**
         * Cleanup and disconnect
         */
        public async Task DisconnectAsync()
        {
            try
            {
                if (_connection != null && _isConnected)
                {
                    await Task.Run(() => _connection.Disconnect(_connectionId));
                    _isConnected = false;
                    Console.WriteLine("✅ Disconnected from PrivMX Bridge");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Disconnect failed: {ex.Message}");
            }
        }

        /**
         * Check connection status
         */
        public bool IsReady()
        {
            return _isConnected && _connection != null;
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (disposing)
                {
                    DisconnectAsync().Wait();
                    _connection?.Dispose();
                }
                _disposed = true;
            }
        }
    }

    // Usage Example
    public class Program
    {
        public static async Task Main(string[] args)
        {
            using var privmx = new PrivMXManager();

            try
            {
                var config = new PrivMXConfig
                {
                    UserPrivateKey = "YOUR_PRIVATE_KEY_WIF",
                    SolutionId = "YOUR_SOLUTION_ID",
                    BridgeUrl = "https://your-bridge.privmx.dev"
                };

                await privmx.InitializeAsync(config);

                ${hasThreads ? this.generateCSharpThreadsExample() : ''}${hasStores ? this.generateCSharpStoresExample() : ''}${hasInboxes ? this.generateCSharpInboxesExample() : ''}${hasCrypto ? this.generateCSharpCryptoExample() : ''}
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Application error: {ex.Message}");
            }
        }
    }
}`;

    return setupCode;
  }

  // Workflow generation stubs
  private generateSecureMessagingWorkflow(
    language: string,
    options: CodeGenerationOptions
  ): string {
    return `// Secure Messaging Workflow for ${language}
// Implementation coming soon`;
  }

  private generateFileSharingWorkflow(
    language: string,
    options: CodeGenerationOptions
  ): string {
    return `// File Sharing Workflow for ${language}
// Implementation coming soon`;
  }

  private generateDataStorageWorkflow(
    language: string,
    options: CodeGenerationOptions
  ): string {
    return `// Data Storage Workflow for ${language}
// Implementation coming soon`;
  }

  // Utility methods
  private async findAPIFiles(basePath: string): Promise<string[]> {
    const files: string[] = [];

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && entry.name !== 'node_modules') {
            await walkDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            // Only include JSON files that look like API specs
            if (fullPath.includes('api') || fullPath.includes('spec')) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Cannot read directory ${dir}:`, error);
      }
    };

    await walkDir(basePath);
    return files;
  }

  private extractLanguageFromPath(filePath: string): string {
    const pathParts = filePath.split(path.sep);

    // Look for language indicators in path
    for (const part of pathParts) {
      if (
        ['js', 'javascript', 'typescript', 'ts'].includes(part.toLowerCase())
      ) {
        return 'javascript';
      }
      if (['java', 'kotlin'].includes(part.toLowerCase())) {
        return 'java';
      }
      if (['swift'].includes(part.toLowerCase())) {
        return 'swift';
      }
      if (['cpp', 'c++', 'cxx'].includes(part.toLowerCase())) {
        return 'cpp';
      }
      if (['csharp', 'c#', 'cs'].includes(part.toLowerCase())) {
        return 'csharp';
      }
    }

    return 'javascript'; // Default
  }

  private getTotalMethods(): number {
    let total = 0;
    for (const methods of this.methodIndex.values()) {
      total += methods.length;
    }
    return total;
  }

  private getTotalClasses(): number {
    let total = 0;
    for (const classes of this.classIndex.values()) {
      total += classes.length;
    }
    return total;
  }

  // Legacy interface compatibility (for gradual migration)
  async searchDocumentation(
    query: string,
    filters?: { type?: string; namespace?: string },
    limit = 5
  ): Promise<SearchResult[]> {
    return this.discoverAPI(query, filters?.namespace);
  }

  async searchApiMethods(
    query: string,
    className?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    const results = await this.discoverAPI(query);
    return results
      .filter(
        (r) =>
          r.metadata.type === 'method' &&
          (!className || r.metadata.className === className)
      )
      .slice(0, limit);
  }

  async searchClasses(
    query: string,
    namespace?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    const results = await this.discoverAPI(query);
    return results
      .filter(
        (r) =>
          r.metadata.type === 'class' &&
          (!namespace || r.metadata.namespace === namespace)
      )
      .slice(0, limit);
  }

  async searchGuides(query: string, limit = 10): Promise<SearchResult[]> {
    // For now, return empty - guides will be handled separately
    return [];
  }

  async getRelatedContent(content: string, limit = 5): Promise<SearchResult[]> {
    // Extract key terms and search
    const terms = content.split(/\s+/).slice(0, 5).join(' ');
    return this.discoverAPI(terms);
  }

  async indexDocumentation(
    path = '/spec',
    force = false
  ): Promise<{ indexed: number; updated: number; errors: number }> {
    console.log(`📚 Re-indexing from: ${path} (force: ${force})`);

    if (force) {
      this.apiIndex.clear();
      this.methodIndex.clear();
      this.classIndex.clear();
      this.languageIndex.clear();
      this.keywordIndex.clear();
      this.initialized = false;
    }

    await this.initialize();

    return {
      indexed: this.apiIndex.size,
      updated: 0,
      errors: 0,
    };
  }

  // Additional compatibility methods
  async search(
    query: string,
    options?: { type?: string; namespace?: string; limit?: number }
  ): Promise<SearchResult[]> {
    return this.searchDocumentation(query, options, options?.limit);
  }

  async searchMethods(
    query: string,
    className?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    return this.searchApiMethods(query, className, limit);
  }

  async clearCollection(): Promise<void> {
    console.log('🗑️ Clearing API knowledge graph');
    this.apiIndex.clear();
    this.methodIndex.clear();
    this.classIndex.clear();
    this.languageIndex.clear();
    this.keywordIndex.clear();
    this.initialized = false;
  }

  async processDirectory(
    path: string
  ): Promise<{ indexed: number; updated: number; errors: number }> {
    return this.indexDocumentation(path, false);
  }

  async processAndStoreDocuments(
    files: string[]
  ): Promise<{ indexed: number; updated: number; errors: number }> {
    console.log(`📄 Processing ${files.length} specific documents`);
    // For now, just trigger full re-index
    return this.indexDocumentation();
  }

  async getDocumentationStats(): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    const byType: Record<string, number> = {};

    for (const [, results] of this.keywordIndex) {
      for (const result of results) {
        const type = result.metadata.type;
        byType[type] = (byType[type] || 0) + 1;
      }
    }

    return {
      total: this.apiIndex.size,
      byType,
    };
  }

  // Feature-specific code generation methods
  private generateThreadsFeature(): string {
    return `

  /**
   * Secure Threads (Messaging) API
   */
  async createThread(users, publicMeta = {}, privateMeta = {}) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const thread = await this.endpoint.thread.createThread(
        this.connectionId,
        JSON.stringify(publicMeta),
        JSON.stringify(privateMeta),
        users // Array of {userId: string, pubKey: string}
      );
      
      console.log('✅ Thread created:', thread.threadId);
      return thread;
    } catch (error) {
      console.error('❌ Thread creation failed:', error);
      throw error;
    }
  }

  async sendMessage(threadId, data, publicMeta = {}, privateMeta = {}) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const message = await this.endpoint.thread.sendMessage(
        threadId,
        JSON.stringify(publicMeta),
        JSON.stringify(privateMeta),
        data
      );
      
      console.log('✅ Message sent:', message.messageId);
      return message;
    } catch (error) {
      console.error('❌ Message sending failed:', error);
      throw error;
    }
  }

  async getMessages(threadId, skip = 0, limit = 10) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const messages = await this.endpoint.thread.getMessages(threadId, skip, limit);
      return messages;
    } catch (error) {
      console.error('❌ Getting messages failed:', error);
      throw error;
    }
  }`;
  }

  private generateStoresFeature(): string {
    return `

  /**
   * Secure Stores (File Sharing) API  
   */
  async createStore(users, publicMeta = {}, privateMeta = {}) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const store = await this.endpoint.store.createStore(
        this.connectionId,
        JSON.stringify(publicMeta),
        JSON.stringify(privateMeta),
        users // Array of {userId: string, pubKey: string}
      );
      
      console.log('✅ Store created:', store.storeId);
      return store;
    } catch (error) {
      console.error('❌ Store creation failed:', error);
      throw error;
    }
  }

  async uploadFile(storeId, fileName, fileData, publicMeta = {}, privateMeta = {}) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const file = await this.endpoint.store.createFile(
        storeId,
        JSON.stringify(publicMeta),
        JSON.stringify(privateMeta),
        fileData.length
      );

      // Write file data
      const uploadHandle = await this.endpoint.store.openFile(file.fileId);
      await this.endpoint.store.writeToFile(uploadHandle, fileData);
      await this.endpoint.store.closeFile(uploadHandle);
      
      console.log('✅ File uploaded:', file.fileId);
      return file;
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    }
  }

  async downloadFile(fileId) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const downloadHandle = await this.endpoint.store.openFile(fileId);
      const fileData = await this.endpoint.store.readFromFile(downloadHandle);
      await this.endpoint.store.closeFile(downloadHandle);
      
      console.log('✅ File downloaded:', fileId);
      return fileData;
    } catch (error) {
      console.error('❌ File download failed:', error);
      throw error;
    }
  }`;
  }

  private generateInboxesFeature(): string {
    return `

  /**
   * Secure Inboxes (Anonymous Submissions) API
   */
  async createInbox(users, publicMeta = {}, privateMeta = {}, filesConfig = {}) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const inbox = await this.endpoint.inbox.createInbox(
        this.connectionId,
        JSON.stringify(publicMeta),
        JSON.stringify(privateMeta),
        users, // Array of {userId: string, pubKey: string}
        JSON.stringify(filesConfig)
      );
      
      console.log('✅ Inbox created:', inbox.inboxId);
      return inbox;
    } catch (error) {
      console.error('❌ Inbox creation failed:', error);
      throw error;
    }
  }

  async sendToInbox(inboxId, data, publicMeta = {}, privateMeta = {}, files = []) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const entry = await this.endpoint.inbox.sendEntry(
        inboxId,
        JSON.stringify(publicMeta),
        JSON.stringify(privateMeta),
        data,
        files
      );
      
      console.log('✅ Entry sent to inbox:', entry.entryId);
      return entry;
    } catch (error) {
      console.error('❌ Sending to inbox failed:', error);
      throw error;
    }
  }

  async getInboxEntries(inboxId, skip = 0, limit = 10) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const entries = await this.endpoint.inbox.getEntries(inboxId, skip, limit);
      return entries;
    } catch (error) {
      console.error('❌ Getting inbox entries failed:', error);
      throw error;
    }
  }`;
  }

  private generateCryptoFeature(): string {
    return `

  /**
   * Crypto API for Key Management
   */
  generateKeyPair() {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const keyPair = this.endpoint.crypto.generateKeyPair();
      console.log('✅ Key pair generated');
      return {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey
      };
    } catch (error) {
      console.error('❌ Key generation failed:', error);
      throw error;
    }
  }

  signData(data, privateKey) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const signature = this.endpoint.crypto.signData(data, privateKey);
      console.log('✅ Data signed');
      return signature;
    } catch (error) {
      console.error('❌ Data signing failed:', error);
      throw error;
    }
  }

  verifySignature(data, signature, publicKey) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    
    try {
      const isValid = this.endpoint.crypto.verifySignature(data, signature, publicKey);
      console.log('✅ Signature verified:', isValid);
      return isValid;
    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      throw error;
    }
  }`;
  }

  // Example usage generation methods
  private generateThreadsExample(): string {
    return `
    // 🔐 Create a secure thread for messaging
    const users = [
      { userId: 'user1', pubKey: 'USER1_PUBLIC_KEY' },
      { userId: 'user2', pubKey: 'USER2_PUBLIC_KEY' }
    ];
    
    const thread = await privmx.createThread(users, {
      title: 'My Secure Chat'
    }, {
      description: 'Private conversation'
    });
    
    // Send a message
    await privmx.sendMessage(thread.threadId, 'Hello, secure world!', {
      messageType: 'text'
    });
    
    // Get messages
    const messages = await privmx.getMessages(thread.threadId);
    console.log('Messages:', messages);`;
  }

  private generateStoresExample(): string {
    return `
    // 📁 Create a secure store for file sharing
    const users = [
      { userId: 'user1', pubKey: 'USER1_PUBLIC_KEY' },
      { userId: 'user2', pubKey: 'USER2_PUBLIC_KEY' }
    ];
    
    const store = await privmx.createStore(users, {
      storeName: 'Shared Files'
    }, {
      description: 'Team file sharing'
    });
    
    // Upload a file
    const fileData = new TextEncoder().encode('Hello from a secure file!');
    const file = await privmx.uploadFile(store.storeId, 'hello.txt', fileData, {
      fileName: 'hello.txt',
      fileType: 'text/plain'
    });
    
    // Download the file
    const downloadedData = await privmx.downloadFile(file.fileId);
    console.log('Downloaded:', new TextDecoder().decode(downloadedData));`;
  }

  private generateInboxesExample(): string {
    return `
    // 📮 Create an inbox for anonymous submissions
    const managers = [
      { userId: 'manager1', pubKey: 'MANAGER1_PUBLIC_KEY' }
    ];
    
    const inbox = await privmx.createInbox(managers, {
      inboxName: 'Feedback Form'
    }, {
      description: 'Anonymous feedback collection'
    });
    
    // Send anonymous entry (can be done without authentication)
    await privmx.sendToInbox(inbox.inboxId, 'Great product!', {
      submissionType: 'feedback'
    }, {
      rating: 5
    });
    
    // Get inbox entries (managers only)
    const entries = await privmx.getInboxEntries(inbox.inboxId);
    console.log('Submissions:', entries);`;
  }

  private generateCryptoExample(): string {
    return `
    // 🔐 Generate cryptographic keys
    const keyPair = privmx.generateKeyPair();
    console.log('Private Key:', keyPair.privateKey);
    console.log('Public Key:', keyPair.publicKey);
    
    // Sign and verify data
    const data = 'Important message';
    const signature = privmx.signData(data, keyPair.privateKey);
    const isValid = privmx.verifySignature(data, signature, keyPair.publicKey);
    console.log('Signature valid:', isValid);`;
  }

  // Java-specific feature generation methods
  private generateJavaThreadsFeature(): string {
    return `

    /**
     * Secure Threads (Messaging) API - Java
     */
    public Thread createThread(List<UserWithPubKey> users, String publicMeta, String privateMeta) 
            throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            Thread thread = endpoint.threadCreateThread(
                connectionId,
                users,
                publicMeta != null ? publicMeta : "{}",
                privateMeta != null ? privateMeta : "{}"
            );
            
            System.out.println("✅ Thread created: " + thread.getThreadId());
            return thread;
        } catch (Exception error) {
            System.err.println("❌ Thread creation failed: " + error.getMessage());
            throw error;
        }
    }

    public Message sendMessage(String threadId, byte[] data, String publicMeta, String privateMeta) 
            throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            Message message = endpoint.threadSendMessage(
                threadId,
                publicMeta != null ? publicMeta : "{}",
                privateMeta != null ? privateMeta : "{}",
                data
            );
            
            System.out.println("✅ Message sent: " + message.getMessageId());
            return message;
        } catch (Exception error) {
            System.err.println("❌ Message sending failed: " + error.getMessage());
            throw error;
        }
    }

    public PagingList<Message> getMessages(String threadId, long skip, long limit) 
            throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            return endpoint.threadListMessages(threadId, skip, limit);
        } catch (Exception error) {
            System.err.println("❌ Getting messages failed: " + error.getMessage());
            throw error;
        }
    }`;
  }

  private generateJavaStoresFeature(): string {
    return `

    /**
     * Secure Stores (File Sharing) API - Java
     */
    public Store createStore(List<UserWithPubKey> users, String publicMeta, String privateMeta) 
            throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            Store store = endpoint.storeCreateStore(
                connectionId,
                users,
                publicMeta != null ? publicMeta : "{}",
                privateMeta != null ? privateMeta : "{}"
            );
            
            System.out.println("✅ Store created: " + store.getStoreId());
            return store;
        } catch (Exception error) {
            System.err.println("❌ Store creation failed: " + error.getMessage());
            throw error;
        }
    }

    public File uploadFile(String storeId, String fileName, byte[] fileData, 
                          String publicMeta, String privateMeta) throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            // Create file
            File file = endpoint.storeCreateFile(
                storeId,
                publicMeta != null ? publicMeta : "{}",
                privateMeta != null ? privateMeta : "{}",
                fileData.length
            );

            // Write file data
            long uploadHandle = endpoint.storeOpenFile(file.getInfo().getFileId());
            endpoint.storeWriteToFile(uploadHandle, fileData);
            endpoint.storeCloseFile(uploadHandle);
            
            System.out.println("✅ File uploaded: " + file.getInfo().getFileId());
            return file;
        } catch (Exception error) {
            System.err.println("❌ File upload failed: " + error.getMessage());
            throw error;
        }
    }

    public byte[] downloadFile(String fileId) throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            long downloadHandle = endpoint.storeOpenFile(fileId);
            byte[] fileData = endpoint.storeReadFromFile(downloadHandle);
            endpoint.storeCloseFile(downloadHandle);
            
            System.out.println("✅ File downloaded: " + fileId);
            return fileData;
        } catch (Exception error) {
            System.err.println("❌ File download failed: " + error.getMessage());
            throw error;
        }
    }`;
  }

  private generateJavaInboxesFeature(): string {
    return `

    /**
     * Secure Inboxes (Anonymous Submissions) API - Java
     */
    public Inbox createInbox(List<UserWithPubKey> users, String publicMeta, 
                            String privateMeta, FilesConfig filesConfig) throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            Inbox inbox = endpoint.inboxCreateInbox(
                connectionId,
                users,
                publicMeta != null ? publicMeta : "{}",
                privateMeta != null ? privateMeta : "{}",
                filesConfig
            );
            
            System.out.println("✅ Inbox created: " + inbox.getInboxId());
            return inbox;
        } catch (Exception error) {
            System.err.println("❌ Inbox creation failed: " + error.getMessage());
            throw error;
        }
    }

    public InboxEntry sendToInbox(String inboxId, byte[] data, String publicMeta, 
                                 String privateMeta, List<InboxFileHandle> files) throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            InboxEntry entry = endpoint.inboxSendEntry(
                inboxId,
                publicMeta != null ? publicMeta : "{}",
                privateMeta != null ? privateMeta : "{}",
                data,
                files != null ? files : new ArrayList<>()
            );
            
            System.out.println("✅ Entry sent to inbox: " + entry.getEntryId());
            return entry;
        } catch (Exception error) {
            System.err.println("❌ Sending to inbox failed: " + error.getMessage());
            throw error;
        }
    }

    public PagingList<InboxEntry> getInboxEntries(String inboxId, long skip, long limit) 
            throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            return endpoint.inboxListEntries(inboxId, skip, limit);
        } catch (Exception error) {
            System.err.println("❌ Getting inbox entries failed: " + error.getMessage());
            throw error;
        }
    }`;
  }

  private generateJavaCryptoFeature(): string {
    return `

    /**
     * Crypto API for Key Management - Java
     */
    public PrivateKey generatePrivateKey() throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            PrivateKey privateKey = endpoint.cryptoGeneratePrivateKey();
            System.out.println("✅ Private key generated");
            return privateKey;
        } catch (Exception error) {
            System.err.println("❌ Key generation failed: " + error.getMessage());
            throw error;
        }
    }

    public PublicKey derivePublicKey(PrivateKey privateKey) throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            PublicKey publicKey = endpoint.cryptoDerivePublicKey(privateKey);
            System.out.println("✅ Public key derived");
            return publicKey;
        } catch (Exception error) {
            System.err.println("❌ Public key derivation failed: " + error.getMessage());
            throw error;
        }
    }

    public byte[] signData(byte[] data, PrivateKey privateKey) throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            byte[] signature = endpoint.cryptoSignData(data, privateKey);
            System.out.println("✅ Data signed");
            return signature;
        } catch (Exception error) {
            System.err.println("❌ Data signing failed: " + error.getMessage());
            throw error;
        }
    }

    public boolean verifySignature(byte[] data, byte[] signature, PublicKey publicKey) 
            throws Exception {
        if (!isReady()) throw new Exception("PrivMX not initialized");
        
        try {
            boolean isValid = endpoint.cryptoVerifySignature(data, signature, publicKey);
            System.out.println("✅ Signature verified: " + isValid);
            return isValid;
        } catch (Exception error) {
            System.err.println("❌ Signature verification failed: " + error.getMessage());
            throw error;
        }
    }`;
  }

  // Java example usage generation methods
  private generateJavaThreadsExample(): string {
    return `
            // 🔐 Create a secure thread for messaging
            List<UserWithPubKey> users = Arrays.asList(
                new UserWithPubKey("user1", "USER1_PUBLIC_KEY"),
                new UserWithPubKey("user2", "USER2_PUBLIC_KEY")
            );
            
            Thread thread = privmx.createThread(users, 
                "{\\"title\\": \\"My Secure Chat\\"}", 
                "{\\"description\\": \\"Private conversation\\"}"
            );
            
            // Send a message
            String messageText = "Hello, secure world!";
            privmx.sendMessage(thread.getThreadId(), 
                messageText.getBytes(StandardCharsets.UTF_8),
                "{\\"messageType\\": \\"text\\"}", 
                null
            );
            
            // Get messages
            PagingList<Message> messages = privmx.getMessages(thread.getThreadId(), 0, 10);
            System.out.println("Messages: " + messages.getReadItems().size());`;
  }

  private generateJavaStoresExample(): string {
    return `
            // 📁 Create a secure store for file sharing
            List<UserWithPubKey> users = Arrays.asList(
                new UserWithPubKey("user1", "USER1_PUBLIC_KEY"),
                new UserWithPubKey("user2", "USER2_PUBLIC_KEY")
            );
            
            Store store = privmx.createStore(users,
                "{\\"storeName\\": \\"Shared Files\\"}", 
                "{\\"description\\": \\"Team file sharing\\"}"
            );
            
            // Upload a file
            String fileContent = "Hello from a secure file!";
            byte[] fileData = fileContent.getBytes(StandardCharsets.UTF_8);
            File file = privmx.uploadFile(store.getStoreId(), "hello.txt", fileData,
                "{\\"fileName\\": \\"hello.txt\\", \\"fileType\\": \\"text/plain\\"}", 
                null
            );
            
            // Download the file
            byte[] downloadedData = privmx.downloadFile(file.getInfo().getFileId());
            String downloadedContent = new String(downloadedData, StandardCharsets.UTF_8);
            System.out.println("Downloaded: " + downloadedContent);`;
  }

  private generateJavaInboxesExample(): string {
    return `
            // 📮 Create an inbox for anonymous submissions
            List<UserWithPubKey> managers = Arrays.asList(
                new UserWithPubKey("manager1", "MANAGER1_PUBLIC_KEY")
            );
            
            FilesConfig filesConfig = new FilesConfig(); // Configure as needed
            Inbox inbox = privmx.createInbox(managers,
                "{\\"inboxName\\": \\"Feedback Form\\"}", 
                "{\\"description\\": \\"Anonymous feedback collection\\"}",
                filesConfig
            );
            
            // Send anonymous entry
            String feedback = "Great product!";
            privmx.sendToInbox(inbox.getInboxId(), 
                feedback.getBytes(StandardCharsets.UTF_8),
                "{\\"submissionType\\": \\"feedback\\"}", 
                "{\\"rating\\": 5}",
                null
            );
            
            // Get inbox entries (managers only)
            PagingList<InboxEntry> entries = privmx.getInboxEntries(inbox.getInboxId(), 0, 10);
            System.out.println("Submissions: " + entries.getReadItems().size());`;
  }

  private generateJavaCryptoExample(): string {
    return `
            // 🔐 Generate cryptographic keys
            PrivateKey privateKey = privmx.generatePrivateKey();
            PublicKey publicKey = privmx.derivePublicKey(privateKey);
            System.out.println("Key pair generated successfully");
            
            // Sign and verify data
            String data = "Important message";
            byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
            byte[] signature = privmx.signData(dataBytes, privateKey);
            boolean isValid = privmx.verifySignature(dataBytes, signature, publicKey);
            System.out.println("Signature valid: " + isValid);`;
  }

  // Swift-specific feature generation methods
  private generateSwiftThreadsFeature(): string {
    return `

    /**
     * Secure Threads (Messaging) API - Swift
     */
    func createThread(users: [privmx.endpoint.core.UserWithPubKey], 
                     publicMeta: [String: Any] = [:], 
                     privateMeta: [String: Any] = [:]) async throws -> privmx.endpoint.thread.Thread {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            let publicMetaData = try JSONSerialization.data(withJSONObject: publicMeta)
            let privateMetaData = try JSONSerialization.data(withJSONObject: privateMeta)
            
            guard let threadApi = endpointSession?.threadApi else {
                throw PrivMXError.operationFailed("Thread API not available")
            }
            
            let thread = try threadApi.createThread(
                users: users,
                publicMeta: publicMetaData,
                privateMeta: privateMetaData
            )
            
            print("✅ Thread created: \\(thread.threadId)")
            return thread
        } catch {
            print("❌ Thread creation failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func sendMessage(threadId: String, 
                    data: Data, 
                    publicMeta: [String: Any] = [:], 
                    privateMeta: [String: Any] = [:]) async throws -> privmx.endpoint.thread.Message {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            let publicMetaData = try JSONSerialization.data(withJSONObject: publicMeta)
            let privateMetaData = try JSONSerialization.data(withJSONObject: privateMeta)
            
            guard let threadApi = endpointSession?.threadApi else {
                throw PrivMXError.operationFailed("Thread API not available")
            }
            
            let message = try threadApi.sendMessage(
                threadId: threadId,
                publicMeta: publicMetaData,
                privateMeta: privateMetaData,
                data: data
            )
            
            print("✅ Message sent: \\(message.messageId)")
            return message
        } catch {
            print("❌ Message sending failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func getMessages(threadId: String, skip: Int64 = 0, limit: Int64 = 10) async throws -> privmx.endpoint.core.PagingList<privmx.endpoint.thread.Message> {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            guard let threadApi = endpointSession?.threadApi else {
                throw PrivMXError.operationFailed("Thread API not available")
            }
            
            return try threadApi.listMessages(threadId: threadId, skip: skip, limit: limit)
        } catch {
            print("❌ Getting messages failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }`;
  }

  private generateSwiftStoresFeature(): string {
    return `

    /**
     * Secure Stores (File Sharing) API - Swift
     */
    func createStore(users: [privmx.endpoint.core.UserWithPubKey], 
                    publicMeta: [String: Any] = [:], 
                    privateMeta: [String: Any] = [:]) async throws -> privmx.endpoint.store.Store {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            let publicMetaData = try JSONSerialization.data(withJSONObject: publicMeta)
            let privateMetaData = try JSONSerialization.data(withJSONObject: privateMeta)
            
            guard let storeApi = endpointSession?.storeApi else {
                throw PrivMXError.operationFailed("Store API not available")
            }
            
            let store = try storeApi.createStore(
                users: users,
                publicMeta: publicMetaData,
                privateMeta: privateMetaData
            )
            
            print("✅ Store created: \\(store.storeId)")
            return store
        } catch {
            print("❌ Store creation failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func uploadFile(storeId: String, 
                   fileName: String, 
                   fileData: Data, 
                   publicMeta: [String: Any] = [:], 
                   privateMeta: [String: Any] = [:]) async throws -> privmx.endpoint.store.File {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            let publicMetaData = try JSONSerialization.data(withJSONObject: publicMeta)
            let privateMetaData = try JSONSerialization.data(withJSONObject: privateMeta)
            
            guard let storeApi = endpointSession?.storeApi else {
                throw PrivMXError.operationFailed("Store API not available")
            }
            
            // Create file
            let file = try storeApi.createFile(
                storeId: storeId,
                publicMeta: publicMetaData,
                privateMeta: privateMetaData,
                size: Int64(fileData.count)
            )
            
            // Write file data
            let uploadHandle = try storeApi.openFile(file.info.fileId)
            try storeApi.writeToFile(uploadHandle, data: fileData)
            try storeApi.closeFile(uploadHandle)
            
            print("✅ File uploaded: \\(file.info.fileId)")
            return file
        } catch {
            print("❌ File upload failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func downloadFile(fileId: String) async throws -> Data {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            guard let storeApi = endpointSession?.storeApi else {
                throw PrivMXError.operationFailed("Store API not available")
            }
            
            let downloadHandle = try storeApi.openFile(fileId)
            let fileData = try storeApi.readFromFile(downloadHandle)
            try storeApi.closeFile(downloadHandle)
            
            print("✅ File downloaded: \\(fileId)")
            return fileData
        } catch {
            print("❌ File download failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }`;
  }

  private generateSwiftInboxesFeature(): string {
    return `

    /**
     * Secure Inboxes (Anonymous Submissions) API - Swift
     */
    func createInbox(users: [privmx.endpoint.core.UserWithPubKey], 
                    publicMeta: [String: Any] = [:], 
                    privateMeta: [String: Any] = [:],
                    filesConfig: privmx.endpoint.inbox.FilesConfig) async throws -> privmx.endpoint.inbox.Inbox {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            let publicMetaData = try JSONSerialization.data(withJSONObject: publicMeta)
            let privateMetaData = try JSONSerialization.data(withJSONObject: privateMeta)
            
            guard let inboxApi = endpointSession?.inboxApi else {
                throw PrivMXError.operationFailed("Inbox API not available")
            }
            
            let inbox = try inboxApi.createInbox(
                users: users,
                publicMeta: publicMetaData,
                privateMeta: privateMetaData,
                filesConfig: filesConfig
            )
            
            print("✅ Inbox created: \\(inbox.inboxId)")
            return inbox
        } catch {
            print("❌ Inbox creation failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func sendToInbox(inboxId: String, 
                    data: Data, 
                    publicMeta: [String: Any] = [:], 
                    privateMeta: [String: Any] = [:],
                    files: [privmx.endpoint.inbox.InboxFileHandle] = []) async throws -> privmx.endpoint.inbox.InboxEntry {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            let publicMetaData = try JSONSerialization.data(withJSONObject: publicMeta)
            let privateMetaData = try JSONSerialization.data(withJSONObject: privateMeta)
            
            guard let inboxApi = endpointSession?.inboxApi else {
                throw PrivMXError.operationFailed("Inbox API not available")
            }
            
            let entry = try inboxApi.sendEntry(
                inboxId: inboxId,
                data: data,
                files: files,
                publicMeta: publicMetaData,
                privateMeta: privateMetaData
            )
            
            print("✅ Entry sent to inbox: \\(entry.entryId)")
            return entry
        } catch {
            print("❌ Sending to inbox failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func getInboxEntries(inboxId: String, skip: Int64 = 0, limit: Int64 = 10) async throws -> privmx.endpoint.core.PagingList<privmx.endpoint.inbox.InboxEntry> {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            guard let inboxApi = endpointSession?.inboxApi else {
                throw PrivMXError.operationFailed("Inbox API not available")
            }
            
            return try inboxApi.listEntries(inboxId: inboxId, skip: skip, limit: limit)
        } catch {
            print("❌ Getting inbox entries failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }`;
  }

  private generateSwiftCryptoFeature(): string {
    return `

    /**
     * Crypto API for Key Management - Swift
     */
    func generatePrivateKey() throws -> privmx.endpoint.crypto.PrivateKey {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            guard let cryptoApi = endpointSession?.cryptoApi else {
                throw PrivMXError.operationFailed("Crypto API not available")
            }
            
            let privateKey = try cryptoApi.generatePrivateKey()
            print("✅ Private key generated")
            return privateKey
        } catch {
            print("❌ Key generation failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func derivePublicKey(privateKey: privmx.endpoint.crypto.PrivateKey) throws -> privmx.endpoint.crypto.PublicKey {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            guard let cryptoApi = endpointSession?.cryptoApi else {
                throw PrivMXError.operationFailed("Crypto API not available")
            }
            
            let publicKey = try cryptoApi.derivePublicKey(privateKey)
            print("✅ Public key derived")
            return publicKey
        } catch {
            print("❌ Public key derivation failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func signData(data: Data, privateKey: privmx.endpoint.crypto.PrivateKey) throws -> Data {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            guard let cryptoApi = endpointSession?.cryptoApi else {
                throw PrivMXError.operationFailed("Crypto API not available")
            }
            
            let signature = try cryptoApi.signData(data, privateKey)
            print("✅ Data signed")
            return signature
        } catch {
            print("❌ Data signing failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }
    
    func verifySignature(data: Data, signature: Data, publicKey: privmx.endpoint.crypto.PublicKey) throws -> Bool {
        guard isReady() else { throw PrivMXError.notInitialized }
        
        do {
            guard let cryptoApi = endpointSession?.cryptoApi else {
                throw PrivMXError.operationFailed("Crypto API not available")
            }
            
            let isValid = try cryptoApi.verifySignature(data, signature, publicKey)
            print("✅ Signature verified: \\(isValid)")
            return isValid
        } catch {
            print("❌ Signature verification failed: \\(error)")
            throw PrivMXError.operationFailed(error.localizedDescription)
        }
    }`;
  }

  // Swift example usage generation methods
  private generateSwiftThreadsExample(): string {
    return `
            // 🔐 Create a secure thread for messaging
            let users = [
                privmx.endpoint.core.UserWithPubKey(userId: "user1", pubKey: "USER1_PUBLIC_KEY"),
                privmx.endpoint.core.UserWithPubKey(userId: "user2", pubKey: "USER2_PUBLIC_KEY")
            ]
            
            let thread = try await privmx.createThread(
                users: users,
                publicMeta: ["title": "My Secure Chat"],
                privateMeta: ["description": "Private conversation"]
            )
            
            // Send a message
            let messageText = "Hello, secure world!"
            let messageData = messageText.data(using: .utf8)!
            try await privmx.sendMessage(
                threadId: thread.threadId,
                data: messageData,
                publicMeta: ["messageType": "text"]
            )
            
            // Get messages
            let messages = try await privmx.getMessages(threadId: thread.threadId)
            print("Messages: \\(messages.readItems.count)")`;
  }

  private generateSwiftStoresExample(): string {
    return `
            // 📁 Create a secure store for file sharing
            let users = [
                privmx.endpoint.core.UserWithPubKey(userId: "user1", pubKey: "USER1_PUBLIC_KEY"),
                privmx.endpoint.core.UserWithPubKey(userId: "user2", pubKey: "USER2_PUBLIC_KEY")
            ]
            
            let store = try await privmx.createStore(
                users: users,
                publicMeta: ["storeName": "Shared Files"],
                privateMeta: ["description": "Team file sharing"]
            )
            
            // Upload a file
            let fileContent = "Hello from a secure file!"
            let fileData = fileContent.data(using: .utf8)!
            let file = try await privmx.uploadFile(
                storeId: store.storeId,
                fileName: "hello.txt",
                fileData: fileData,
                publicMeta: ["fileName": "hello.txt", "fileType": "text/plain"]
            )
            
            // Download the file
            let downloadedData = try await privmx.downloadFile(fileId: file.info.fileId)
            let downloadedContent = String(data: downloadedData, encoding: .utf8) ?? ""
            print("Downloaded: \\(downloadedContent)")`;
  }

  private generateSwiftInboxesExample(): string {
    return `
            // 📮 Create an inbox for anonymous submissions
            let managers = [
                privmx.endpoint.core.UserWithPubKey(userId: "manager1", pubKey: "MANAGER1_PUBLIC_KEY")
            ]
            
            let filesConfig = privmx.endpoint.inbox.FilesConfig() // Configure as needed
            let inbox = try await privmx.createInbox(
                users: managers,
                publicMeta: ["inboxName": "Feedback Form"],
                privateMeta: ["description": "Anonymous feedback collection"],
                filesConfig: filesConfig
            )
            
            // Send anonymous entry
            let feedback = "Great product!"
            let feedbackData = feedback.data(using: .utf8)!
            try await privmx.sendToInbox(
                inboxId: inbox.inboxId,
                data: feedbackData,
                publicMeta: ["submissionType": "feedback"],
                privateMeta: ["rating": 5]
            )
            
            // Get inbox entries (managers only)
            let entries = try await privmx.getInboxEntries(inboxId: inbox.inboxId)
            print("Submissions: \\(entries.readItems.count)")`;
  }

  private generateSwiftCryptoExample(): string {
    return `
            // 🔐 Generate cryptographic keys
            let privateKey = try privmx.generatePrivateKey()
            let publicKey = try privmx.derivePublicKey(privateKey: privateKey)
            print("Key pair generated successfully")
            
            // Sign and verify data
            let data = "Important message".data(using: .utf8)!
            let signature = try privmx.signData(data: data, privateKey: privateKey)
            let isValid = try privmx.verifySignature(data: data, signature: signature, publicKey: publicKey)
            print("Signature valid: \\(isValid)")`;
  }

  // C#-specific feature generation methods
  private generateCSharpThreadsFeature(): string {
    return `

        /**
         * Secure Threads (Messaging) API - C#
         */
        public async Task<Privmx.Endpoint.Thread.Thread> CreateThreadAsync(
            List<UserWithPubKey> users, 
            object publicMeta = null, 
            object privateMeta = null)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var publicMetaJson = publicMeta != null ? JsonSerializer.Serialize(publicMeta) : "{}";
                var privateMetaJson = privateMeta != null ? JsonSerializer.Serialize(privateMeta) : "{}";

                var threadApi = new ThreadApi(_connection);
                var thread = await Task.Run(() => threadApi.CreateThread(
                    _connectionId,
                    users,
                    Encoding.UTF8.GetBytes(publicMetaJson),
                    Encoding.UTF8.GetBytes(privateMetaJson)
                ));

                Console.WriteLine($"✅ Thread created: {thread.ThreadId}");
                return thread;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Thread creation failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<Privmx.Endpoint.Thread.Message> SendMessageAsync(
            string threadId, 
            byte[] data, 
            object publicMeta = null, 
            object privateMeta = null)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var publicMetaJson = publicMeta != null ? JsonSerializer.Serialize(publicMeta) : "{}";
                var privateMetaJson = privateMeta != null ? JsonSerializer.Serialize(privateMeta) : "{}";

                var threadApi = new ThreadApi(_connection);
                var message = await Task.Run(() => threadApi.SendMessage(
                    threadId,
                    Encoding.UTF8.GetBytes(publicMetaJson),
                    Encoding.UTF8.GetBytes(privateMetaJson),
                    data
                ));

                Console.WriteLine($"✅ Message sent: {message.MessageId}");
                return message;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Message sending failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<PagingList<Privmx.Endpoint.Thread.Message>> GetMessagesAsync(
            string threadId, 
            long skip = 0, 
            long limit = 10)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var threadApi = new ThreadApi(_connection);
                return await Task.Run(() => threadApi.ListMessages(threadId, skip, limit));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Getting messages failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }`;
  }

  private generateCSharpStoresFeature(): string {
    return `

        /**
         * Secure Stores (File Sharing) API - C#
         */
        public async Task<Privmx.Endpoint.Store.Store> CreateStoreAsync(
            List<UserWithPubKey> users, 
            object publicMeta = null, 
            object privateMeta = null)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var publicMetaJson = publicMeta != null ? JsonSerializer.Serialize(publicMeta) : "{}";
                var privateMetaJson = privateMeta != null ? JsonSerializer.Serialize(privateMeta) : "{}";

                var storeApi = new StoreApi(_connection);
                var store = await Task.Run(() => storeApi.CreateStore(
                    _connectionId,
                    users,
                    Encoding.UTF8.GetBytes(publicMetaJson),
                    Encoding.UTF8.GetBytes(privateMetaJson)
                ));

                Console.WriteLine($"✅ Store created: {store.StoreId}");
                return store;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Store creation failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<Privmx.Endpoint.Store.File> UploadFileAsync(
            string storeId, 
            string fileName, 
            byte[] fileData, 
            object publicMeta = null, 
            object privateMeta = null)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var publicMetaJson = publicMeta != null ? JsonSerializer.Serialize(publicMeta) : "{}";
                var privateMetaJson = privateMeta != null ? JsonSerializer.Serialize(privateMeta) : "{}";

                var storeApi = new StoreApi(_connection);

                // Create file
                var file = await Task.Run(() => storeApi.CreateFile(
                    storeId,
                    Encoding.UTF8.GetBytes(publicMetaJson),
                    Encoding.UTF8.GetBytes(privateMetaJson),
                    fileData.Length
                ));

                // Write file data
                var uploadHandle = await Task.Run(() => storeApi.OpenFile(file.Info.FileId));
                await Task.Run(() => storeApi.WriteToFile(uploadHandle, fileData));
                await Task.Run(() => storeApi.CloseFile(uploadHandle));

                Console.WriteLine($"✅ File uploaded: {file.Info.FileId}");
                return file;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ File upload failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<byte[]> DownloadFileAsync(string fileId)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var storeApi = new StoreApi(_connection);

                var downloadHandle = await Task.Run(() => storeApi.OpenFile(fileId));
                var fileData = await Task.Run(() => storeApi.ReadFromFile(downloadHandle));
                await Task.Run(() => storeApi.CloseFile(downloadHandle));

                Console.WriteLine($"✅ File downloaded: {fileId}");
                return fileData;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ File download failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }`;
  }

  private generateCSharpInboxesFeature(): string {
    return `

        /**
         * Secure Inboxes (Anonymous Submissions) API - C#
         */
        public async Task<Privmx.Endpoint.Inbox.Inbox> CreateInboxAsync(
            List<UserWithPubKey> users, 
            object publicMeta = null, 
            object privateMeta = null,
            FilesConfig filesConfig = null)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var publicMetaJson = publicMeta != null ? JsonSerializer.Serialize(publicMeta) : "{}";
                var privateMetaJson = privateMeta != null ? JsonSerializer.Serialize(privateMeta) : "{}";

                var inboxApi = new InboxApi(_connection);
                var inbox = await Task.Run(() => inboxApi.CreateInbox(
                    _connectionId,
                    users,
                    Encoding.UTF8.GetBytes(publicMetaJson),
                    Encoding.UTF8.GetBytes(privateMetaJson),
                    filesConfig ?? new FilesConfig()
                ));

                Console.WriteLine($"✅ Inbox created: {inbox.InboxId}");
                return inbox;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Inbox creation failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<Privmx.Endpoint.Inbox.InboxEntry> SendToInboxAsync(
            string inboxId, 
            byte[] data, 
            object publicMeta = null, 
            object privateMeta = null,
            List<InboxFileHandle> files = null)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var publicMetaJson = publicMeta != null ? JsonSerializer.Serialize(publicMeta) : "{}";
                var privateMetaJson = privateMeta != null ? JsonSerializer.Serialize(privateMeta) : "{}";

                var inboxApi = new InboxApi(_connection);
                var entry = await Task.Run(() => inboxApi.SendEntry(
                    inboxId,
                    Encoding.UTF8.GetBytes(publicMetaJson),
                    Encoding.UTF8.GetBytes(privateMetaJson),
                    data,
                    files ?? new List<InboxFileHandle>()
                ));

                Console.WriteLine($"✅ Entry sent to inbox: {entry.EntryId}");
                return entry;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Sending to inbox failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<PagingList<Privmx.Endpoint.Inbox.InboxEntry>> GetInboxEntriesAsync(
            string inboxId, 
            long skip = 0, 
            long limit = 10)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var inboxApi = new InboxApi(_connection);
                return await Task.Run(() => inboxApi.ListEntries(inboxId, skip, limit));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Getting inbox entries failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }`;
  }

  private generateCSharpCryptoFeature(): string {
    return `

        /**
         * Crypto API for Key Management - C#
         */
        public async Task<PrivateKey> GeneratePrivateKeyAsync()
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var cryptoApi = new CryptoApi(_connection);
                var privateKey = await Task.Run(() => cryptoApi.GeneratePrivateKey());

                Console.WriteLine("✅ Private key generated");
                return privateKey;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Key generation failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<PublicKey> DerivePublicKeyAsync(PrivateKey privateKey)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var cryptoApi = new CryptoApi(_connection);
                var publicKey = await Task.Run(() => cryptoApi.DerivePublicKey(privateKey));

                Console.WriteLine("✅ Public key derived");
                return publicKey;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Public key derivation failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<byte[]> SignDataAsync(byte[] data, PrivateKey privateKey)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var cryptoApi = new CryptoApi(_connection);
                var signature = await Task.Run(() => cryptoApi.SignData(data, privateKey));

                Console.WriteLine("✅ Data signed");
                return signature;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Data signing failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }

        public async Task<bool> VerifySignatureAsync(byte[] data, byte[] signature, PublicKey publicKey)
        {
            if (!IsReady())
                throw new PrivMXException(PrivMXError.NotInitialized, "PrivMX not initialized");

            try
            {
                var cryptoApi = new CryptoApi(_connection);
                var isValid = await Task.Run(() => cryptoApi.VerifySignature(data, signature, publicKey));

                Console.WriteLine($"✅ Signature verified: {isValid}");
                return isValid;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Signature verification failed: {ex.Message}");
                throw new PrivMXException(PrivMXError.OperationFailed, ex.Message, ex);
            }
        }`;
  }

  // C# example usage generation methods
  private generateCSharpThreadsExample(): string {
    return `
                // 🔐 Create a secure thread for messaging
                var users = new List<UserWithPubKey>
                {
                    new UserWithPubKey { UserId = "user1", PubKey = "USER1_PUBLIC_KEY" },
                    new UserWithPubKey { UserId = "user2", PubKey = "USER2_PUBLIC_KEY" }
                };

                var thread = await privmx.CreateThreadAsync(users,
                    new { title = "My Secure Chat" },
                    new { description = "Private conversation" }
                );

                // Send a message
                var messageText = "Hello, secure world!";
                var messageData = Encoding.UTF8.GetBytes(messageText);
                await privmx.SendMessageAsync(thread.ThreadId, messageData,
                    new { messageType = "text" }
                );

                // Get messages
                var messages = await privmx.GetMessagesAsync(thread.ThreadId);
                Console.WriteLine($"Messages: {messages.ReadItems.Count}");`;
  }

  private generateCSharpStoresExample(): string {
    return `
                // 📁 Create a secure store for file sharing
                var users = new List<UserWithPubKey>
                {
                    new UserWithPubKey { UserId = "user1", PubKey = "USER1_PUBLIC_KEY" },
                    new UserWithPubKey { UserId = "user2", PubKey = "USER2_PUBLIC_KEY" }
                };

                var store = await privmx.CreateStoreAsync(users,
                    new { storeName = "Shared Files" },
                    new { description = "Team file sharing" }
                );

                // Upload a file
                var fileContent = "Hello from a secure file!";
                var fileData = Encoding.UTF8.GetBytes(fileContent);
                var file = await privmx.UploadFileAsync(store.StoreId, "hello.txt", fileData,
                    new { fileName = "hello.txt", fileType = "text/plain" }
                );

                // Download the file
                var downloadedData = await privmx.DownloadFileAsync(file.Info.FileId);
                var downloadedContent = Encoding.UTF8.GetString(downloadedData);
                Console.WriteLine($"Downloaded: {downloadedContent}");`;
  }

  private generateCSharpInboxesExample(): string {
    return `
                // 📮 Create an inbox for anonymous submissions
                var managers = new List<UserWithPubKey>
                {
                    new UserWithPubKey { UserId = "manager1", PubKey = "MANAGER1_PUBLIC_KEY" }
                };

                var filesConfig = new FilesConfig(); // Configure as needed
                var inbox = await privmx.CreateInboxAsync(managers,
                    new { inboxName = "Feedback Form" },
                    new { description = "Anonymous feedback collection" },
                    filesConfig
                );

                // Send anonymous entry
                var feedback = "Great product!";
                var feedbackData = Encoding.UTF8.GetBytes(feedback);
                await privmx.SendToInboxAsync(inbox.InboxId, feedbackData,
                    new { submissionType = "feedback" },
                    new { rating = 5 }
                );

                // Get inbox entries (managers only)
                var entries = await privmx.GetInboxEntriesAsync(inbox.InboxId);
                Console.WriteLine($"Submissions: {entries.ReadItems.Count}");`;
  }

  private generateCSharpCryptoExample(): string {
    return `
                // 🔐 Generate cryptographic keys
                var privateKey = await privmx.GeneratePrivateKeyAsync();
                var publicKey = await privmx.DerivePublicKeyAsync(privateKey);
                Console.WriteLine("Key pair generated successfully");

                // Sign and verify data
                var data = Encoding.UTF8.GetBytes("Important message");
                var signature = await privmx.SignDataAsync(data, privateKey);
                var isValid = await privmx.VerifySignatureAsync(data, signature, publicKey);
                Console.WriteLine($"Signature valid: {isValid}");`;
  }
}
