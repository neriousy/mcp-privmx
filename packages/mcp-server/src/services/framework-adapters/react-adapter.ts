/**
 * React Framework Adapter - Phase 2
 * Adapts generic PrivMX code to React-specific patterns and best practices
 */

import { CodeContext, ValidationResult } from '../../types/index.js';

// Local type definitions for framework adapter
interface ConfigFile {
  filename: string;
  content: string;
  description: string;
}

interface ProjectStructure {
  directories: string[];
  requiredFiles: string[];
  conventions: CodeConvention[];
}

interface CodeConvention {
  rule: string;
  description: string;
  example?: string;
}

interface FrameworkAdapter {
  name: string;
  supportedLanguages: string[];
  adaptCode(code: string, context: CodeContext): Promise<string>;
  generateImports(dependencies: string[]): string;
  generateConfig(): ConfigFile[];
  generateProjectConfiguration(
    projectName: string,
    context: CodeContext
  ): Promise<Record<string, string>>;
  validateCode(code: string): Promise<ValidationResult>;
  getProjectStructure(): ProjectStructure;
}

export class ReactAdapter implements FrameworkAdapter {
  name = 'React';
  supportedLanguages = ['javascript', 'typescript'];

  /**
   * Adapt generic code to React patterns
   */
  async adaptCode(code: string, context: CodeContext): Promise<string> {
    let adaptedCode = code;

    // Convert to React component if not already
    if (!this.isReactComponent(code)) {
      adaptedCode = this.wrapInReactComponent(adaptedCode, context);
    }

    // Add React hooks for state management
    adaptedCode = this.addReactHooks(adaptedCode);

    // Add proper error boundaries
    adaptedCode = this.addErrorHandling(adaptedCode);

    // Optimize for React performance
    adaptedCode = this.addPerformanceOptimizations(adaptedCode);

    return adaptedCode;
  }

  /**
   * Generate React-specific imports
   */
  generateImports(dependencies: string[]): string {
    const reactImports = [
      "import React, { useState, useEffect, useCallback, useMemo } from 'react';",
      "import { Endpoint } from '@privmx/privmx-webendpoint-sdk';",
    ];

    // Add conditional imports based on dependencies
    if (dependencies.includes('threads')) {
      reactImports.push('// Thread management for secure messaging');
    }
    if (dependencies.includes('stores')) {
      reactImports.push('// Store management for file sharing');
    }
    if (dependencies.includes('inboxes')) {
      reactImports.push('// Inbox management for anonymous submissions');
    }

    return reactImports.join('\n');
  }

  /**
   * Generate React project configuration files
   */
  generateConfig(): ConfigFile[] {
    return [
      {
        filename: 'package.json',
        content: this.generatePackageJson(),
        description: 'React project dependencies and scripts',
      },
      {
        filename: 'vite.config.js',
        content: this.generateViteConfig(),
        description: 'Vite configuration for modern React development',
      },
      {
        filename: '.eslintrc.js',
        content: this.generateESLintConfig(),
        description: 'ESLint configuration for React best practices',
      },
      {
        filename: 'README.md',
        content: this.generateReadme(),
        description: 'Project setup and usage instructions',
      },
    ];
  }

  /**
   * Validate React code for common issues
   */
  async validateCode(code: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for common React anti-patterns
    if (code.includes('useState') && !code.includes('useCallback')) {
      warnings.push(
        'Consider using useCallback for event handlers to prevent unnecessary re-renders'
      );
    }

    if (code.includes('useEffect') && !code.includes('[]')) {
      warnings.push(
        'useEffect should have a dependency array to prevent infinite loops'
      );
    }

    if (code.includes('async') && code.includes('useEffect')) {
      errors.push(
        'useEffect callback cannot be async. Use an inner async function instead'
      );
    }

    // Check for accessibility issues
    if (
      code.includes('<div') &&
      code.includes('onClick') &&
      !code.includes('role=')
    ) {
      suggestions.push(
        'Add proper ARIA roles for clickable divs or use semantic elements'
      );
    }

    // Check for performance issues
    if (code.includes('new Date()') && code.includes('render')) {
      warnings.push(
        'Avoid creating new objects in render. Use useMemo for expensive calculations'
      );
    }

    return {
      isValid: errors.length === 0,
      issues: [...errors, ...warnings],
      suggestions,
    };
  }

  /**
   * Get React project structure
   */
  getProjectStructure(): ProjectStructure {
    return {
      directories: [
        'src',
        'src/components',
        'src/hooks',
        'src/services',
        'src/utils',
        'src/types',
        'src/styles',
        'public',
      ],
      requiredFiles: [
        'package.json',
        'vite.config.js',
        'index.html',
        'src/main.tsx',
        'src/App.tsx',
        'src/index.css',
      ],
      conventions: [
        {
          rule: 'Component files should use PascalCase (e.g., UserProfile.tsx)',
          description: 'React components follow PascalCase naming convention',
          example: 'src/components/PrivMXChat.tsx',
        },
        {
          rule: 'Custom hooks should start with "use" prefix',
          description: 'React hooks must follow the useXxx naming pattern',
          example: 'src/hooks/usePrivMX.ts',
        },
        {
          rule: 'Use functional components with hooks instead of class components',
          description: 'Modern React development favors functional components',
          example: 'const MyComponent = () => { ... }',
        },
      ],
    };
  }

  /**
   * Check if code is already a React component
   */
  private isReactComponent(code: string): boolean {
    return (
      code.includes('export') &&
      (code.includes('const ') || code.includes('function ')) &&
      code.includes('return') &&
      code.includes('<')
    );
  }

  /**
   * Wrap generic code in a React component
   */
  private wrapInReactComponent(code: string, context: CodeContext): string {
    const componentName = 'PrivMXApp';
    const isTypeScript = context.language === 'typescript';
    const extension = isTypeScript ? 'tsx' : 'jsx';

    return `import React, { useState, useEffect } from 'react';
import { Endpoint } from '@privmx/privmx-webendpoint-sdk';

interface PrivMXAppProps {
  bridgeUrl: string;
  solutionId: string;
  userPrivateKey: string;
}

export const ${componentName}${isTypeScript ? ': React.FC<PrivMXAppProps>' : ''} = ({ 
  bridgeUrl, 
  solutionId, 
  userPrivateKey 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState${isTypeScript ? '<string | null>' : ''}(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializePrivMX();
  }, []);

  const initializePrivMX = async () => {
    try {
      setLoading(true);
      setError(null);
      
      ${this.indentCode(code, 6)}
      
      setIsConnected(true);
    } catch (err) {
      console.error('PrivMX initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="privmx-loading">
        <div className="loading-spinner" />
        <p>Connecting to PrivMX...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="privmx-error">
        <h3>Connection Error</h3>
        <p>{error}</p>
        <button onClick={initializePrivMX}>Retry Connection</button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="privmx-disconnected">
        <p>Not connected to PrivMX</p>
        <button onClick={initializePrivMX}>Connect</button>
      </div>
    );
  }

  return (
    <div className="privmx-app">
      <header className="privmx-header">
        <h1>PrivMX Secure Application</h1>
        <div className="connection-status">✅ Connected</div>
      </header>
      
      <main className="privmx-main">
        {/* Your PrivMX application content goes here */}
        <p>PrivMX is connected and ready to use!</p>
      </main>
    </div>
  );
};

export default ${componentName};`;
  }

  /**
   * Add React hooks for state management
   */
  private addReactHooks(code: string): string {
    // Add useState for common PrivMX state
    if (code.includes('privmx') && !code.includes('useState')) {
      code = code.replace(
        'const [isConnected',
        `const [privmxState, setPrivmxState] = useState({ endpoint: null, connected: false });
  const [isConnected`
      );
    }

    // Add useCallback for event handlers
    if (code.includes('const ') && code.includes(' = async () => {')) {
      code = code.replace(
        /const (\w+) = async \(\) => \{/g,
        'const $1 = useCallback(async () => {'
      );
    }

    return code;
  }

  /**
   * Add error boundaries and error handling
   */
  private addErrorHandling(code: string): string {
    if (!code.includes('try {') && code.includes('await')) {
      // Wrap async operations in try-catch
      code = code.replace(
        /(await .*?;)/g,
        `try {
        $1
      } catch (error) {
        console.error('PrivMX operation failed:', error);
        setError(error instanceof Error ? error.message : 'Operation failed');
      }`
      );
    }

    return code;
  }

  /**
   * Add React performance optimizations
   */
  private addPerformanceOptimizations(code: string): string {
    // Add useMemo for expensive calculations
    if (code.includes('new Date()') || code.includes('.map(')) {
      code = `import React, { useState, useEffect, useMemo, useCallback } from 'react';\n${code}`;
    }

    // Optimize component re-renders
    if (code.includes('onClick=') && !code.includes('useCallback')) {
      code = code.replace(
        /onClick=\{(\w+)\}/g,
        'onClick={useCallback($1, [])}'
      );
    }

    return code;
  }

  /**
   * Generate package.json for React project
   */
  private generatePackageJson(): string {
    return JSON.stringify(
      {
        name: 'privmx-react-app',
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          lint: 'eslint src --ext .ts,.tsx',
          'lint:fix': 'eslint src --ext .ts,.tsx --fix',
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@privmx/privmx-webendpoint-sdk': '^1.0.0',
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.0.0',
          eslint: '^8.45.0',
          'eslint-plugin-react': '^7.32.0',
          'eslint-plugin-react-hooks': '^4.6.0',
          typescript: '^5.0.0',
          vite: '^4.4.0',
        },
      },
      null,
      2
    );
  }

  /**
   * Generate Vite configuration
   */
  private generateViteConfig(): string {
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    global: 'globalThis'
  }
})`;
  }

  /**
   * Generate ESLint configuration
   */
  private generateESLintConfig(): string {
    return `module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    'react',
    '@typescript-eslint'
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': 'warn'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};`;
  }

  /**
   * Generate README for React project
   */
  private generateReadme(): string {
    return `# PrivMX React Application

A secure React application built with PrivMX for end-to-end encrypted communication.

## Features

- 🔐 End-to-end encryption
- 💬 Secure messaging
- 📁 Encrypted file sharing
- 📮 Anonymous submissions
- ⚡ Real-time updates

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure PrivMX:**
   - Copy your PrivMX credentials
   - Update the configuration in \`src/config/privmx.config.ts\`

3. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Open in browser:**
   Navigate to \`http://localhost:3000\`

## Configuration

Update \`src/config/privmx.config.ts\` with your PrivMX settings:

\`\`\`typescript
export const privmxConfig = {
  bridgeUrl: 'https://your-bridge.privmx.dev',
  solutionId: 'your-solution-id',
  userPrivateKey: 'your-private-key-wif'
};
\`\`\`

## Project Structure

\`\`\`
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── services/           # PrivMX service integration
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── styles/             # CSS styles
\`\`\`

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm run lint\` - Run ESLint

## Security Notes

- Never commit private keys to version control
- Use environment variables for sensitive configuration
- Regularly update PrivMX SDK and dependencies

## Learn More

- [PrivMX Documentation](https://docs.privmx.dev)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
`;
  }

  /**
   * Indent code by specified number of spaces
   */
  private indentCode(code: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return code
      .split('\n')
      .map((line) => (line.trim() ? indent + line : line))
      .join('\n');
  }

  /**
   * Generate project configuration files
   */
  async generateProjectConfiguration(
    projectName: string,
    context: CodeContext
  ): Promise<Record<string, string>> {
    const configs: Record<string, string> = {};

    // Package.json
    configs['package.json'] = JSON.stringify(
      {
        name: projectName.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          test: 'vitest',
          lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@privmx/endpoint': '^1.0.0',
        },
        devDependencies: {
          '@types/react': '^18.2.43',
          '@types/react-dom': '^18.2.17',
          '@typescript-eslint/eslint-plugin': '^6.14.0',
          '@typescript-eslint/parser': '^6.14.0',
          '@vitejs/plugin-react': '^4.2.1',
          eslint: '^8.55.0',
          'eslint-plugin-react-hooks': '^4.6.0',
          'eslint-plugin-react-refresh': '^0.4.5',
          typescript: '^5.2.2',
          vite: '^5.0.8',
          vitest: '^1.0.4',
        },
      },
      null,
      2
    );

    // Vite config
    configs['vite.config.ts'] = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
`;

    // TypeScript config
    configs['tsconfig.json'] = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }],
      },
      null,
      2
    );

    // ESLint config
    configs['.eslintrc.cjs'] = `module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
`;

    // Index.html
    configs['index.html'] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

    return configs;
  }

  /**
   * Legacy interface compatibility methods
   */
}
