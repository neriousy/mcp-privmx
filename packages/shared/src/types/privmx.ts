/**
 * PrivMX WebEndpoint Types
 * Generated from PrivMX API specification
 */

export interface UserWithPubKey {
  userId: string;
  pubKey: string;
}

export interface UserInfo {
  user: UserWithPubKey;
  isActive: boolean;
}

export interface Context {
  userId: string;
  contextId: string;
}

export interface PagingQuery {
  skip: number;
  limit: number;
  sortOrder: 'asc' | 'desc';
  lastId: string;
  queryAsJson: string;
}

export interface PagingList<T> {
  totalAvailable: number;
  readItems: T[];
}

export interface Thread {
  contextId: string;
  threadId: string;
  createDate: number;
  creator: string;
  lastModificationDate: number;
  lastModifier: string;
  users: string[];
  managers: string[];
  version: number;
  lastMsgDate: number;
  publicMeta: Uint8Array;
  privateMeta: Uint8Array;
  policy: ContainerPolicy;
  messagesCount: number;
  statusCode: number;
}

export interface Message {
  info: ServerMessageInfo;
  publicMeta: Uint8Array;
  privateMeta: Uint8Array;
  data: Uint8Array;
  authorPubKey: string;
  statusCode: number;
}

export interface ServerMessageInfo {
  threadId: string;
  messageId: string;
  createDate: number;
  author: string;
}

export interface Store {
  storeId: string;
  contextId: string;
  createDate: number;
  creator: string;
  lastModificationDate: number;
  lastFileDate: number;
  lastModifier: string;
  users: string[];
  managers: string[];
  version: number;
  publicMeta: Uint8Array;
  privateMeta: Uint8Array;
  policy: ContainerPolicy;
  filesCount: number;
  statusCode: number;
}

export interface File {
  info: ServerFileInfo;
  publicMeta: Uint8Array;
  privateMeta: Uint8Array;
  size: number;
  authorPubKey: string;
  statusCode: number;
}

export interface ServerFileInfo {
  storeId: string;
  fileId: string;
  createDate: number;
  author: string;
}

export interface Inbox {
  inboxId: string;
  contextId: string;
  createDate: number;
  creator: string;
  lastModificationDate: number;
  lastModifier: string;
  users: string[];
  managers: string[];
  version: number;
  publicMeta: Uint8Array;
  privateMeta: Uint8Array;
  filesConfig: FilesConfig;
  policy: ContainerWithoutItemPolicy;
  statusCode: number;
}

export interface InboxEntry {
  entryId: string;
  inboxId: string;
  data: Uint8Array;
  files: File[];
  authorPubKey: string;
  createDate: number;
  statusCode: number;
}

export interface FilesConfig {
  minCount: number;
  maxCount: number;
  maxFileSize: number;
  maxWholeUploadSize: number;
}

export interface ContainerPolicy {
  get: PolicyEntry;
  update: PolicyEntry;
  delete: PolicyEntry;
  updatePolicy: PolicyEntry;
  updaterCanBeRemovedFromManagers: PolicyBooleanEntry;
  ownerCanBeRemovedFromManagers: PolicyBooleanEntry;
  item: ItemPolicy;
}

export interface ContainerWithoutItemPolicy {
  get: PolicyEntry;
  update: PolicyEntry;
  delete: PolicyEntry;
  updatePolicy: PolicyEntry;
  updaterCanBeRemovedFromManagers: PolicyBooleanEntry;
  ownerCanBeRemovedFromManagers: PolicyBooleanEntry;
}

export interface PolicyEntry {
  // Implementation details will be added based on actual usage
}

export interface PolicyBooleanEntry {
  // Implementation details will be added based on actual usage
}

export interface ItemPolicy {
  get: PolicyEntry;
  listMy: PolicyEntry;
  listAll: PolicyEntry;
  create: PolicyEntry;
  update: PolicyEntry;
  delete: PolicyEntry;
}

export interface Event {
  type: string;
  channel: string;
  connectionId: number;
  data: unknown;
} 