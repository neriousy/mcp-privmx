/**
 * JavaScript/TypeScript Code Generator
 * Generates production-ready setup code for PrivMX WebEndpoint
 */

import { BaseCodeGenerator } from './base-generator.js';
import {
  threadImports,
  threadImplementation,
  threadExample,
} from './modules/thread-feature-js.js';
import { renderTemplate } from './template-renderer.js';

export class JavaScriptGenerator extends BaseCodeGenerator {
  generateSetup(features: string[]): string {
    return renderTemplate('codegen/javascript/setup.hbs', {
      language: 'javascript',
      features,
    });
  }

  generateThreadsFeature(): string {
    return `
${threadImplementation}
  `;
  }

  generateStoresFeature(): string {
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

  generateInboxesFeature(): string {
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

  generateCryptoFeature(): string {
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

  generateThreadsExample(): string {
    return threadExample;
  }

  generateStoresExample(): string {
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

  generateInboxesExample(): string {
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

  generateCryptoExample(): string {
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
}
