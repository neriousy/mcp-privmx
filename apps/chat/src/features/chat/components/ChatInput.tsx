import {
  Send,
  Settings,
  Mic,
  Paperclip,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useRef, useEffect } from 'react';
import { Button } from '@/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select';
import { Badge } from '@/ui/components/ui/badge';
import { Alert, AlertDescription } from '@/ui/components/ui/alert';
import { cn } from '@/ui/lib/utils';
import {
  useFileUpload,
  useDragAndDrop,
} from '@/features/chat/hooks/useFileUpload';
import { useSpeechRecognition } from '@/features/chat/hooks/useSpeechRecognition';

import { AttachedFile } from '@/app/page';
import {
  FILE_SIZE_LIMITS,
  formatFileSize,
  getAllSupportedTypes,
} from '@/lib/utils/file-utils';
import { UploadedFile } from '@/types';
import { FileList } from './FileAttachment';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  selectedModel: string;
  mcpConnected: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (
    e: React.FormEvent,
    attachedFiles?: AttachedFile[]
  ) => Promise<void>;
  onModelChange: (model: string) => void;
  onMcpToggle: () => void;
}

export function ChatInput({
  input,
  isLoading,
  selectedModel,
  mcpConnected,
  onInputChange,
  onSubmit,
  onModelChange,
  onMcpToggle,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    files,
    isProcessing,
    error: fileError,
    totalSize,
    addFiles,
    removeFile,
    clearFiles,
    clearError,
  } = useFileUpload(5);

  const { isDragActive, dragProps } = useDragAndDrop(
    (droppedFiles: File[]) => addFiles(droppedFiles),
    getAllSupportedTypes()
  );

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: speechSupported,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    continuous: false,
    interimResults: true,
    language: 'en-US',
  });

  // Handle speech recognition results
  useEffect(() => {
    if (transcript) {
      // Create a synthetic event to trigger input change
      const syntheticEvent = {
        target: {
          value: input + ' ' + transcript,
        },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      onInputChange(syntheticEvent);
      resetTranscript();
    }
  }, [transcript, input, onInputChange, resetTranscript]);

  const handleMicClick = () => {
    if (!speechSupported) {
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !isProcessing && (input.trim() || files.length > 0)) {
        handleSubmitWithFiles(e as React.FormEvent);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleSubmitWithFiles = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length > 0) {
      // Convert UploadedFile[] to format expected by the parent component
      const fileAttachments = files.map((file: UploadedFile) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        content: file.content,
        url: file.url,
      }));

      try {
        await onSubmit(e, fileAttachments);
        clearFiles(); // Clear files after successful send
      } catch (error) {
        console.error('Failed to send message with files:', error);
      }
    } else {
      try {
        await onSubmit(e);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const canSubmit =
    !isLoading && !isProcessing && (input.trim() || files.length > 0);

  return (
    <motion.div
      className="p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      layout
    >
      <div className="max-w-4xl mx-auto">
        {/* Model Selection and Settings */}
        <motion.div
          className="flex items-center gap-2 mb-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
        >
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={mcpConnected ? 'default' : 'outline'}
            size="sm"
            onClick={onMcpToggle}
            className="h-8 px-3 text-xs"
          >
            <Settings className="w-3 h-3 mr-1" />
            MCP
            {mcpConnected && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                ON
              </Badge>
            )}
          </Button>

          {/* File Upload Stats */}
          {files.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
              <span>•</span>
              <span>{formatFileSize(totalSize)}</span>
            </div>
          )}
        </motion.div>

        {/* File Error Alert */}
        <AnimatePresence>
          {fileError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  {fileError}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="h-6 px-2 text-xs"
                  >
                    Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speech Error Alert */}
        <AnimatePresence>
          {speechError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  {speechError}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resetTranscript()}
                    className="h-6 px-2 text-xs"
                  >
                    Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File List */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <FileList files={files} onRemove={removeFile} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <motion.form
          onSubmit={handleSubmitWithFiles}
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
        >
          <div
            className={cn(
              'relative flex items-end gap-2 p-3 border border-input rounded-xl bg-background shadow-sm transition-all duration-200',
              'focus-within:ring-1 focus-within:ring-ring',
              isDragActive && 'border-primary bg-primary/5 ring-1 ring-primary'
            )}
            {...dragProps}
          >
            {/* Drag Overlay */}
            <AnimatePresence>
              {isDragActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center z-10"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium text-primary">
                      Drop files here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Up to {formatFileSize(FILE_SIZE_LIMITS.MAX_FILE_SIZE)} per
                      file
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={getAllSupportedTypes().join(',')}
              onChange={handleFileInputChange}
              className="hidden"
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Paperclip
                className={cn('h-4 w-4', isProcessing && 'animate-spin')}
              />
            </Button>

            <textarea
              value={input + (interimTranscript ? ' ' + interimTranscript : '')}
              onChange={onInputChange}
              onKeyPress={handleKeyPress}
              placeholder={
                isListening
                  ? 'Listening... Speak now'
                  : 'Ask anything about PrivMX development...'
              }
              className={cn(
                'flex-1 min-h-[20px] max-h-32 bg-transparent border-0 resize-none text-sm placeholder:text-muted-foreground focus-visible:outline-none',
                isListening && 'ring-1 ring-red-500/20'
              )}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '20px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />

            <div className="flex items-center gap-1">
              {speechSupported && (
                <Button
                  type="button"
                  variant={isListening ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 w-8 p-0',
                    isListening
                      ? 'text-white bg-red-500 hover:bg-red-600'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={handleMicClick}
                  disabled={isProcessing}
                >
                  <Mic
                    className={cn('h-4 w-4', isListening && 'animate-pulse')}
                  />
                </Button>
              )}

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit}
                  className="h-8 w-8 p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.form>

        {/* Helper Text */}
        <motion.div
          className="mt-2 text-xs text-muted-foreground text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Supports text, code, images, and documents up to{' '}
          {formatFileSize(FILE_SIZE_LIMITS.MAX_FILE_SIZE)} each
        </motion.div>
      </div>
    </motion.div>
  );
}
