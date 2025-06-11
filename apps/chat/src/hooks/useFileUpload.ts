import { useState, useCallback } from 'react';
import { UploadedFile, validateFiles, processFile } from '../lib/file-utils';

interface UseFileUploadReturn {
  files: UploadedFile[];
  isProcessing: boolean;
  error: string | null;
  totalSize: number;
  addFiles: (newFiles: File[]) => Promise<void>;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  clearError: () => void;
}

export function useFileUpload(maxFiles: number = 5): UseFileUploadReturn {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const addFiles = useCallback(
    async (newFiles: File[]) => {
      setError(null);

      // Check if adding these files would exceed the limit
      if (files.length + newFiles.length > maxFiles) {
        setError(`Cannot upload more than ${maxFiles} files at once`);
        return;
      }

      // Validate files
      const validation = validateFiles([
        ...files.map(
          (f) =>
            ({
              name: f.name,
              size: f.size,
              type: f.type,
            }) as File
        ),
        ...newFiles,
      ]);

      if (!validation.isValid) {
        setError(validation.error || 'File validation failed');
        return;
      }

      setIsProcessing(true);

      try {
        // Process files in parallel
        const processedFiles = await Promise.all(
          newFiles.map((file) => processFile(file))
        );

        setFiles((prev) => [...prev, ...processedFiles]);
      } catch (err) {
        console.error('Failed to process files:', err);
        setError('Failed to process files. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files.length, maxFiles]
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
    setError(null);
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    files,
    isProcessing,
    error,
    totalSize,
    addFiles,
    removeFile,
    clearFiles,
    clearError,
  };
}

// Drag and drop utilities
export interface UseDragAndDropReturn {
  isDragActive: boolean;
  dragProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

export function useDragAndDrop(
  onFilesDropped: (files: File[]) => void,
  accept?: string[]
): UseDragAndDropReturn {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set drag inactive if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const droppedFiles = Array.from(e.dataTransfer.files);

      // Filter files by accepted types if specified
      const filteredFiles = accept
        ? droppedFiles.filter((file) =>
            accept.some(
              (type) =>
                file.type === type ||
                file.name.toLowerCase().endsWith(type.replace('*', ''))
            )
          )
        : droppedFiles;

      if (filteredFiles.length > 0) {
        onFilesDropped(filteredFiles);
      }
    },
    [onFilesDropped, accept]
  );

  return {
    isDragActive,
    dragProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}
