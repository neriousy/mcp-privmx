// Auto-generated extraction of thread feature code for JS/TS generators

export const threadImports = ['// Threads for secure messaging'];

export const threadImplementation = `
  /**
   * Secure Threads (Messaging) API
   */
  async createThread(users, publicMeta = {}, privateMeta = {}) {
    if (!this.isReady()) throw new Error('PrivMX not initialized');
    const thread = await this.endpoint.thread.createThread(
      this.connectionId,
      JSON.stringify(publicMeta),
      JSON.stringify(privateMeta),
      users,
    );
    return thread;
  }
`;

export const threadExample = `
    // 🔐 Create a secure thread for messaging
    const users = [ { userId: 'user1', pubKey: 'PUB1' } ];
    const thread = await privmx.createThread(users, { title: 'My Chat' });
`;
