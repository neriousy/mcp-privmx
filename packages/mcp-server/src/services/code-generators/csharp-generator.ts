/**
 * C# Code Generator
 * Generates production-ready setup code for PrivMX Endpoint C# (.NET)
 */

import { BaseCodeGenerator } from './base-generator.js';

export class CSharpGenerator extends BaseCodeGenerator {
  generateSetup(features: string[]): string {
    const hasThreads = this.hasFeature(features, 'threads');
    const hasStores = this.hasFeature(features, 'stores');
    const hasInboxes = this.hasFeature(features, 'inboxes');
    const hasCrypto = this.hasFeature(features, 'crypto');

    const imports = [
      'using System;',
      'using System.Collections.Generic;',
      'using System.Text;',
      'using System.Threading.Tasks;',
      'using PrivMX.Endpoint;',
      'using PrivMX.Endpoint.Model;',
      'using Newtonsoft.Json;',
    ];

    if (hasThreads) imports.push('// Threads for secure messaging');
    if (hasStores) imports.push('// Stores for encrypted file sharing');
    if (hasInboxes) imports.push('// Inboxes for anonymous submissions');
    if (hasCrypto) imports.push('// Crypto for key management');

    const setupCode = `
/**
 * PrivMX Endpoint Setup - C# Production Ready (.NET)
 * Generated by PrivMX MCP Server
 * 
 * Requirements:
 * NuGet Package Manager Console:
 * Install-Package PrivMX.Endpoint -Version 2.0.0
 * 
 * Or PackageReference in .csproj:
 * <PackageReference Include="PrivMX.Endpoint" Version="2.0.0" />
 * 
 * Requires .NET 6.0 or higher for modern async/await patterns
 */

${this.generateImports(imports)}

namespace PrivMXApp
{
    /// <summary>
    /// Configuration class for PrivMX connection
    /// </summary>
    public class PrivMXConfig
    {
        public string UserPrivateKey { get; }
        public string SolutionId { get; }
        public string BridgeUrl { get; }

        public PrivMXConfig(string userPrivateKey, string solutionId, string bridgeUrl = "https://your-bridge.privmx.dev")
        {
            UserPrivateKey = userPrivateKey ?? throw new ArgumentNullException(nameof(userPrivateKey));
            SolutionId = solutionId ?? throw new ArgumentNullException(nameof(solutionId));
            BridgeUrl = bridgeUrl ?? "https://your-bridge.privmx.dev";
        }
    }

    /// <summary>
    /// User representation for PrivMX operations
    /// </summary>
    public class PrivMXUser
    {
        public string UserId { get; }
        public string PubKey { get; }

        public PrivMXUser(string userId, string pubKey)
        {
            UserId = userId ?? throw new ArgumentNullException(nameof(userId));
            PubKey = pubKey ?? throw new ArgumentNullException(nameof(pubKey));
        }
    }

    /// <summary>
    /// Custom exception for PrivMX operations
    /// </summary>
    public class PrivMXException : Exception
    {
        public PrivMXException(string message) : base(message) { }
        public PrivMXException(string message, Exception innerException) : base(message, innerException) { }
    }

    /// <summary>
    /// Main PrivMX Manager - handles all PrivMX operations with modern .NET async/await
    /// Implements IDisposable for proper resource management
    /// </summary>
    public class PrivMXManager : IDisposable
    {
        private PrivmxEndpoint? _endpoint;
        private long _connectionId;
        private bool _isConnected;
        private bool _disposed;

        /// <summary>
        /// Initialize PrivMX and connect to Bridge
        /// </summary>
        public async Task<long> InitializeAsync(string userPrivateKey, string solutionId, string bridgeUrl = "https://your-bridge.privmx.dev")
        {
            try
            {
                _endpoint = new PrivmxEndpoint();
                _connectionId = await _endpoint.ConnectAsync(userPrivateKey, solutionId, bridgeUrl);
                _isConnected = true;
                Console.WriteLine($"✅ Connected to PrivMX Bridge: {_connectionId}");
                return _connectionId;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ PrivMX initialization failed: {error.Message}");
                throw;
            }
        }

        /// <summary>
        /// Check if PrivMX is ready for operations
        /// </summary>
        public bool IsReady => _isConnected && _endpoint != null && !_disposed;

        /// <summary>
        /// Cleanup and disconnect
        /// </summary>
        public async Task DisconnectAsync()
        {
            try
            {
                if (_endpoint != null && _isConnected && !_disposed)
                {
                    await _endpoint.DisconnectAsync(_connectionId);
                    _isConnected = false;
                    Console.WriteLine("✅ Disconnected from PrivMX Bridge");
                }
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Disconnect failed: {error.Message}");
            }
        }

        /// <summary>
        /// Dispose pattern implementation
        /// </summary>
        public void Dispose()
        {
            if (!_disposed)
            {
                if (_endpoint != null && _isConnected)
                {
                    try
                    {
                        _endpoint.DisconnectAsync(_connectionId).GetAwaiter().GetResult();
                    }
                    catch { }
                }
                _endpoint?.Dispose();
                _disposed = true;
            }
        }
    }

    /// <summary>
    /// Example usage of PrivMXManager
    /// </summary>
    public class Program
    {
        public static async Task Main(string[] args)
        {
            using var privmx = new PrivMXManager();
            
            try
            {
                await privmx.InitializeAsync(
                    "YOUR_PRIVATE_KEY_WIF",
                    "YOUR_SOLUTION_ID",
                    "https://your-bridge.privmx.dev"
                );
                
                Console.WriteLine("PrivMX C# setup complete!");
            }
            catch (Exception error)
            {
                Console.WriteLine($"Application error: {error.Message}");
            }
            finally
            {
                await privmx.DisconnectAsync();
            }
        }
    }
}`;

    return setupCode;
  }

  generateThreadsFeature(): string {
    return `

        #region Secure Threads (Messaging) API

        /// <summary>
        /// Create a secure thread for messaging
        /// </summary>
        public async Task<Thread> CreateThreadAsync(List<UserWithPubKey> users, string publicMeta = "{}", string privateMeta = "{}")
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var thread = await _endpoint!.ThreadCreateThreadAsync(
                    _connectionId,
                    users,
                    publicMeta,
                    privateMeta
                );
                
                Console.WriteLine($"✅ Thread created: {thread.ThreadId}");
                return thread;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Thread creation failed: {error.Message}");
                throw new PrivMXException($"Thread creation failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Send a message to a thread
        /// </summary>
        public async Task<Message> SendMessageAsync(string threadId, byte[] data, string publicMeta = "{}", string privateMeta = "{}")
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var message = await _endpoint!.ThreadSendMessageAsync(
                    threadId,
                    publicMeta,
                    privateMeta,
                    data
                );
                
                Console.WriteLine($"✅ Message sent: {message.MessageId}");
                return message;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Message sending failed: {error.Message}");
                throw new PrivMXException($"Message sending failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Get messages from a thread
        /// </summary>
        public async Task<PagingList<Message>> GetMessagesAsync(string threadId, long skip = 0, long limit = 10)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                return await _endpoint!.ThreadListMessagesAsync(threadId, skip, limit);
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Getting messages failed: {error.Message}");
                throw new PrivMXException($"Getting messages failed: {error.Message}", error);
            }
        }

        #endregion`;
  }

  generateStoresFeature(): string {
    return `

        #region Secure Stores (File Sharing) API

        /// <summary>
        /// Create a secure store for file sharing
        /// </summary>
        public async Task<Store> CreateStoreAsync(List<UserWithPubKey> users, string publicMeta = "{}", string privateMeta = "{}")
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var store = await _endpoint!.StoreCreateStoreAsync(
                    _connectionId,
                    users,
                    publicMeta,
                    privateMeta
                );
                
                Console.WriteLine($"✅ Store created: {store.StoreId}");
                return store;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Store creation failed: {error.Message}");
                throw new PrivMXException($"Store creation failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Upload a file to a store
        /// </summary>
        public async Task<File> UploadFileAsync(string storeId, string fileName, byte[] fileData, string publicMeta = "{}", string privateMeta = "{}")
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                // Create file
                var file = await _endpoint!.StoreCreateFileAsync(
                    storeId,
                    publicMeta,
                    privateMeta,
                    fileData.Length
                );

                // Write file data
                var uploadHandle = await _endpoint.StoreOpenFileAsync(file.Info.FileId);
                await _endpoint.StoreWriteToFileAsync(uploadHandle, fileData);
                await _endpoint.StoreCloseFileAsync(uploadHandle);
                
                Console.WriteLine($"✅ File uploaded: {file.Info.FileId}");
                return file;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ File upload failed: {error.Message}");
                throw new PrivMXException($"File upload failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Download a file from a store
        /// </summary>
        public async Task<byte[]> DownloadFileAsync(string fileId)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var downloadHandle = await _endpoint!.StoreOpenFileAsync(fileId);
                var fileData = await _endpoint.StoreReadFromFileAsync(downloadHandle);
                await _endpoint.StoreCloseFileAsync(downloadHandle);
                
                Console.WriteLine($"✅ File downloaded: {fileId}");
                return fileData;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ File download failed: {error.Message}");
                throw new PrivMXException($"File download failed: {error.Message}", error);
            }
        }

        #endregion`;
  }

  generateInboxesFeature(): string {
    return `

        #region Secure Inboxes (Anonymous Submissions) API

        /// <summary>
        /// Create an inbox for anonymous submissions
        /// </summary>
        public async Task<Inbox> CreateInboxAsync(List<UserWithPubKey> users, string publicMeta = "{}", string privateMeta = "{}", FilesConfig? filesConfig = null)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var inbox = await _endpoint!.InboxCreateInboxAsync(
                    _connectionId,
                    users,
                    publicMeta,
                    privateMeta,
                    filesConfig ?? new FilesConfig()
                );
                
                Console.WriteLine($"✅ Inbox created: {inbox.InboxId}");
                return inbox;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Inbox creation failed: {error.Message}");
                throw new PrivMXException($"Inbox creation failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Send an entry to an inbox (anonymous submission)
        /// </summary>
        public async Task<InboxEntry> SendToInboxAsync(string inboxId, byte[] data, string publicMeta = "{}", string privateMeta = "{}", List<InboxFileHandle>? files = null)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var entry = await _endpoint!.InboxSendEntryAsync(
                    inboxId,
                    publicMeta,
                    privateMeta,
                    data,
                    files ?? new List<InboxFileHandle>()
                );
                
                Console.WriteLine($"✅ Entry sent to inbox: {entry.EntryId}");
                return entry;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Sending to inbox failed: {error.Message}");
                throw new PrivMXException($"Sending to inbox failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Get entries from an inbox (managers only)
        /// </summary>
        public async Task<PagingList<InboxEntry>> GetInboxEntriesAsync(string inboxId, long skip = 0, long limit = 10)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                return await _endpoint!.InboxListEntriesAsync(inboxId, skip, limit);
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Getting inbox entries failed: {error.Message}");
                throw new PrivMXException($"Getting inbox entries failed: {error.Message}", error);
            }
        }

        #endregion`;
  }

  generateCryptoFeature(): string {
    return `

        #region Crypto API for Key Management

        /// <summary>
        /// Generate a new private key
        /// </summary>
        public async Task<PrivateKey> GeneratePrivateKeyAsync()
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var privateKey = await _endpoint!.CryptoGeneratePrivateKeyAsync();
                Console.WriteLine("✅ Private key generated");
                return privateKey;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Key generation failed: {error.Message}");
                throw new PrivMXException($"Key generation failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Derive public key from private key
        /// </summary>
        public async Task<PublicKey> DerivePublicKeyAsync(PrivateKey privateKey)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var publicKey = await _endpoint!.CryptoDerivePublicKeyAsync(privateKey);
                Console.WriteLine("✅ Public key derived");
                return publicKey;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Public key derivation failed: {error.Message}");
                throw new PrivMXException($"Public key derivation failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Sign data with private key
        /// </summary>
        public async Task<byte[]> SignDataAsync(byte[] data, PrivateKey privateKey)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var signature = await _endpoint!.CryptoSignDataAsync(data, privateKey);
                Console.WriteLine("✅ Data signed");
                return signature;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Data signing failed: {error.Message}");
                throw new PrivMXException($"Data signing failed: {error.Message}", error);
            }
        }

        /// <summary>
        /// Verify signature with public key
        /// </summary>
        public async Task<bool> VerifySignatureAsync(byte[] data, byte[] signature, PublicKey publicKey)
        {
            if (!IsReady) throw new PrivMXException("PrivMX not initialized");
            
            try
            {
                var isValid = await _endpoint!.CryptoVerifySignatureAsync(data, signature, publicKey);
                Console.WriteLine($"✅ Signature verified: {isValid}");
                return isValid;
            }
            catch (Exception error)
            {
                Console.WriteLine($"❌ Signature verification failed: {error.Message}");
                throw new PrivMXException($"Signature verification failed: {error.Message}", error);
            }
        }

        #endregion`;
  }

  generateThreadsExample(): string {
    return `
                // 🔐 Create a secure thread for messaging
                var users = new List<UserWithPubKey>
                {
                    new UserWithPubKey("user1", "USER1_PUBLIC_KEY"),
                    new UserWithPubKey("user2", "USER2_PUBLIC_KEY")
                };
                
                var thread = await privmx.CreateThreadAsync(
                    users,
                    "{\\"title\\": \\"My Secure Chat\\"}",
                    "{\\"description\\": \\"Private conversation\\"}"
                );
                
                // Send a message
                var messageText = "Hello, secure world!";
                var messageData = Encoding.UTF8.GetBytes(messageText);
                await privmx.SendMessageAsync(
                    thread.ThreadId,
                    messageData,
                    "{\\"messageType\\": \\"text\\"}"
                );
                
                // Get messages
                var messages = await privmx.GetMessagesAsync(thread.ThreadId, 0, 10);
                Console.WriteLine($"Messages: {messages.ReadItems.Count}");`;
  }

  generateStoresExample(): string {
    return `
                // 📁 Create a secure store for file sharing
                var users = new List<UserWithPubKey>
                {
                    new UserWithPubKey("user1", "USER1_PUBLIC_KEY"),
                    new UserWithPubKey("user2", "USER2_PUBLIC_KEY")
                };
                
                var store = await privmx.CreateStoreAsync(
                    users,
                    "{\\"storeName\\": \\"Shared Files\\"}",
                    "{\\"description\\": \\"Team file sharing\\"}"
                );
                
                // Upload a file
                var fileContent = "Hello from a secure file!";
                var fileData = Encoding.UTF8.GetBytes(fileContent);
                var file = await privmx.UploadFileAsync(
                    store.StoreId,
                    "hello.txt",
                    fileData,
                    "{\\"fileName\\": \\"hello.txt\\", \\"fileType\\": \\"text/plain\\"}"
                );
                
                // Download the file
                var downloadedData = await privmx.DownloadFileAsync(file.Info.FileId);
                var downloadedContent = Encoding.UTF8.GetString(downloadedData);
                Console.WriteLine($"Downloaded: {downloadedContent}");`;
  }

  generateInboxesExample(): string {
    return `
                // 📮 Create an inbox for anonymous submissions
                var managers = new List<UserWithPubKey>
                {
                    new UserWithPubKey("manager1", "MANAGER1_PUBLIC_KEY")
                };
                
                var inbox = await privmx.CreateInboxAsync(
                    managers,
                    "{\\"inboxName\\": \\"Feedback Form\\"}",
                    "{\\"description\\": \\"Anonymous feedback collection\\"}"
                );
                
                // Send anonymous entry
                var feedback = "Great product!";
                var feedbackData = Encoding.UTF8.GetBytes(feedback);
                await privmx.SendToInboxAsync(
                    inbox.InboxId,
                    feedbackData,
                    "{\\"submissionType\\": \\"feedback\\"}",
                    "{\\"rating\\": 5}"
                );
                
                // Get inbox entries (managers only)
                var entries = await privmx.GetInboxEntriesAsync(inbox.InboxId, 0, 10);
                Console.WriteLine($"Submissions: {entries.ReadItems.Count}");`;
  }

  generateCryptoExample(): string {
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
