import { X, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import {
  UploadedFile,
  formatFileSize,
  SUPPORTED_FILE_TYPES,
} from '../lib/file-utils';
import { motion } from 'motion/react';
import Image from 'next/image';

interface FileAttachmentProps {
  file: UploadedFile;
  onRemove?: (fileId: string) => void;
  showRemove?: boolean;
  className?: string;
}

export function FileAttachment({
  file,
  onRemove,
  showRemove = true,
  className = '',
}: FileAttachmentProps) {
  const getFileIcon = () => {
    if (SUPPORTED_FILE_TYPES.IMAGE.includes(file.type)) {
      return <ImageIcon className="w-4 h-4" />;
    }
    if (SUPPORTED_FILE_TYPES.DOCUMENT.includes(file.type)) {
      return <FileSpreadsheet className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const getFileColor = () => {
    if (SUPPORTED_FILE_TYPES.IMAGE.includes(file.type)) {
      return 'text-green-500';
    }
    if (SUPPORTED_FILE_TYPES.DOCUMENT.includes(file.type)) {
      return 'text-blue-500';
    }
    return 'text-gray-500';
  };

  return (
    <motion.div
      className={`flex items-center gap-2 bg-muted rounded-lg p-3 border ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {/* File Icon */}
      <div className={`flex-shrink-0 ${getFileColor()}`}>{getFileIcon()}</div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {file.name}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatFileSize(file.size)}
          </span>
        </div>

        {/* File Type */}
        <div className="text-xs text-muted-foreground mt-1">
          {file.type || 'Unknown type'}
        </div>
      </div>

      {/* Image Preview */}
      {file.url && SUPPORTED_FILE_TYPES.IMAGE.includes(file.type) && (
        <div className="flex-shrink-0">
          <Image
            width={100}
            height={100}
            src={file.url}
            alt={file.name}
            className="w-12 h-12 object-cover rounded border"
          />
        </div>
      )}

      {/* Remove Button */}
      {showRemove && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(file.id)}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </motion.div>
  );
}

interface FileListProps {
  files: UploadedFile[];
  onRemove?: (fileId: string) => void;
  showRemove?: boolean;
  className?: string;
}

export function FileList({
  files,
  onRemove,
  showRemove = true,
  className = '',
}: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {files.map((file) => (
        <FileAttachment
          key={file.id}
          file={file}
          onRemove={onRemove}
          showRemove={showRemove}
        />
      ))}
    </div>
  );
}

// File preview for text content
interface FilePreviewProps {
  file: UploadedFile;
  maxLines?: number;
}

export function FilePreview({ file, maxLines = 10 }: FilePreviewProps) {
  if (!file.content) return null;

  const lines = file.content.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const hasMore = maxLines && lines.length > maxLines;

  return (
    <div className="mt-2 border rounded-lg overflow-hidden">
      <div className="bg-muted px-3 py-2 border-b">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {file.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {lines.length} lines
          </span>
        </div>
      </div>
      <pre className="text-xs p-3 overflow-x-auto bg-background max-h-64 overflow-y-auto">
        <code>{displayLines.join('\n')}</code>
        {hasMore && (
          <div className="text-muted-foreground mt-2 italic">
            ... and {lines.length - maxLines} more lines
          </div>
        )}
      </pre>
    </div>
  );
}
