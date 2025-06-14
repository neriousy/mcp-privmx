// File handling utilities for the chat application

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  url?: string;
  lastModified: number;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB total
};

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  TEXT: [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
  ],
  CODE: [
    'text/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++src',
    'text/x-csharp',
    'text/x-php',
    'text/x-ruby',
    'text/x-go',
    'text/x-rust',
    'text/x-swift',
    'text/x-kotlin',
    'text/x-typescript',
  ],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  IMAGE: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
};

export const getAllSupportedTypes = (): string[] => {
  return [
    ...SUPPORTED_FILE_TYPES.TEXT,
    ...SUPPORTED_FILE_TYPES.CODE,
    ...SUPPORTED_FILE_TYPES.DOCUMENT,
    ...SUPPORTED_FILE_TYPES.IMAGE,
  ];
};

export const validateFile = (file: File): FileValidationResult => {
  // Check file size
  if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${formatFileSize(FILE_SIZE_LIMITS.MAX_FILE_SIZE)}`,
    };
  }

  // Check file type
  const supportedTypes = getAllSupportedTypes();
  if (!supportedTypes.includes(file.type) && !isTextFile(file)) {
    return {
      isValid: false,
      error: `File type "${file.type}" is not supported`,
    };
  }

  return { isValid: true };
};

export const validateFiles = (files: File[]): FileValidationResult => {
  // Check total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > FILE_SIZE_LIMITS.MAX_TOTAL_SIZE) {
    return {
      isValid: false,
      error: `Total file size exceeds ${formatFileSize(FILE_SIZE_LIMITS.MAX_TOTAL_SIZE)}`,
    };
  }

  // Validate each file
  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.isValid) {
      return validation;
    }
  }

  return { isValid: true };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileIcon = (fileType: string): string => {
  if (
    SUPPORTED_FILE_TYPES.TEXT.includes(fileType) ||
    SUPPORTED_FILE_TYPES.CODE.includes(fileType)
  ) {
    return '📄';
  }
  if (SUPPORTED_FILE_TYPES.IMAGE.includes(fileType)) {
    return '🖼️';
  }
  if (SUPPORTED_FILE_TYPES.DOCUMENT.includes(fileType)) {
    return '📊';
  }
  return '📎';
};

export const isTextFile = (file: File): boolean => {
  // Check if file extension suggests it's a text file
  const textExtensions = [
    '.txt',
    '.md',
    '.json',
    '.xml',
    '.html',
    '.css',
    '.js',
    '.ts',
    '.py',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.php',
    '.rb',
    '.go',
    '.rs',
    '.swift',
    '.kt',
    '.sql',
    '.yaml',
    '.yml',
  ];

  const fileName = file.name.toLowerCase();
  return textExtensions.some((ext) => fileName.endsWith(ext));
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

export const processFile = async (file: File): Promise<UploadedFile> => {
  const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let content: string | undefined;
  let url: string | undefined;

  // For text files, read content
  if (isTextFile(file) || SUPPORTED_FILE_TYPES.TEXT.includes(file.type)) {
    try {
      content = await readFileAsText(file);
    } catch (error) {
      console.warn('Failed to read file as text:', error);
    }
  }

  // For images, create data URL
  if (SUPPORTED_FILE_TYPES.IMAGE.includes(file.type)) {
    try {
      url = await readFileAsDataURL(file);
    } catch (error) {
      console.warn('Failed to read file as data URL:', error);
    }
  }

  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    content,
    url,
    lastModified: file.lastModified,
  };
};

export const generateFileId = (): string => {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
