/**
 * PrivMX Secure Chat Application Template
 * Plop.js configuration with PrivMX intelligence
 */

import { PlopGeneratorConfig } from 'plop';

export const secureChatTemplate: PlopGeneratorConfig = {
  description: 'Generate a complete PrivMX secure chat application',
  prompts: [
    {
      type: 'input',
      name: 'appName',
      message: 'What is your app name?',
      default: 'secure-chat-app',
    },
    {
      type: 'list',
      name: 'framework',
      message: 'Choose your framework:',
      choices: [
        { name: 'React (Recommended for PrivMX)', value: 'react' },
        { name: 'Vue.js', value: 'vue' },
        { name: 'Vanilla JavaScript', value: 'vanilla' },
        { name: 'Node.js Backend', value: 'nodejs' },
      ],
      default: 'react',
    },
    {
      type: 'list',
      name: 'language',
      message: 'Choose your language:',
      choices: [
        { name: 'TypeScript (Recommended)', value: 'typescript' },
        { name: 'JavaScript', value: 'javascript' },
      ],
      default: 'typescript',
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select PrivMX features to include:',
      choices: [
        { name: 'Real-time messaging', value: 'messaging', checked: true },
        { name: 'File sharing', value: 'file-sharing', checked: true },
        { name: 'User authentication', value: 'auth', checked: true },
        { name: 'Message encryption', value: 'encryption', checked: true },
        { name: 'Offline support', value: 'offline', checked: false },
        { name: 'Push notifications', value: 'notifications', checked: false },
      ],
    },
    {
      type: 'confirm',
      name: 'includeTests',
      message: 'Include test files?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'includeDocker',
      message: 'Include Docker configuration?',
      default: false,
    },
  ],
  actions: (data) => {
    const actions = [];
    const framework = data?.framework || 'react';
    const language = data?.language || 'typescript';
    const ext = language === 'typescript' ? 'ts' : 'js';
    const jsxExt = language === 'typescript' ? 'tsx' : 'jsx';

    // Package.json
    actions.push({
      type: 'add',
      path: '{{appName}}/package.json',
      templateFile: `templates/privmx/secure-chat/package.json.hbs`,
    });

    // Main app files based on framework
    if (framework === 'react') {
      actions.push({
        type: 'add',
        path: `{{appName}}/src/App.${jsxExt}`,
        templateFile: `templates/privmx/secure-chat/react/App.${jsxExt}.hbs`,
      });

      actions.push({
        type: 'add',
        path: `{{appName}}/src/components/ChatRoom.${jsxExt}`,
        templateFile: `templates/privmx/secure-chat/react/ChatRoom.${jsxExt}.hbs`,
      });

      actions.push({
        type: 'add',
        path: `{{appName}}/src/hooks/usePrivMX.${ext}`,
        templateFile: `templates/privmx/secure-chat/react/usePrivMX.${ext}.hbs`,
      });
    }

    // PrivMX configuration
    actions.push({
      type: 'add',
      path: `{{appName}}/src/config/privmx.${ext}`,
      templateFile: `templates/privmx/secure-chat/config/privmx.${ext}.hbs`,
    });

    // Services
    actions.push({
      type: 'add',
      path: `{{appName}}/src/services/ChatService.${ext}`,
      templateFile: `templates/privmx/secure-chat/services/ChatService.${ext}.hbs`,
    });

    // Types (if TypeScript)
    if (language === 'typescript') {
      actions.push({
        type: 'add',
        path: '{{appName}}/src/types/privmx.ts',
        templateFile: 'templates/privmx/secure-chat/types/privmx.ts.hbs',
      });
    }

    // Tests (if requested)
    if (data?.includeTests) {
      actions.push({
        type: 'add',
        path: `{{appName}}/src/__tests__/ChatService.test.${ext}`,
        templateFile: `templates/privmx/secure-chat/tests/ChatService.test.${ext}.hbs`,
      });
    }

    // Docker (if requested)
    if (data?.includeDocker) {
      actions.push({
        type: 'add',
        path: '{{appName}}/Dockerfile',
        templateFile: 'templates/privmx/secure-chat/docker/Dockerfile.hbs',
      });

      actions.push({
        type: 'add',
        path: '{{appName}}/docker-compose.yml',
        templateFile:
          'templates/privmx/secure-chat/docker/docker-compose.yml.hbs',
      });
    }

    // README with PrivMX setup instructions
    actions.push({
      type: 'add',
      path: '{{appName}}/README.md',
      templateFile: 'templates/privmx/secure-chat/README.md.hbs',
    });

    return actions;
  },
};

export default secureChatTemplate;
