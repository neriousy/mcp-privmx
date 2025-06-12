'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  RefreshCw,
  Trash2,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import { Badge } from '@/ui/components/ui/badge';
import { Alert, AlertDescription } from '@/ui/components/ui/alert';
import Link from 'next/link';

interface EmbeddingsStatus {
  hasEmbeddings: boolean;
  totalEmbeddings: number;
  lastUpdated: string | null;
  indexSize: string;
  configuration: {
    chunkSize: number;
    overlap: number;
    model: string;
  };
}

export default function EmbeddingsDashboard() {
  const [status, setStatus] = useState<EmbeddingsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<
    Array<{
      timestamp: string;
      message: string;
      type: 'info' | 'success' | 'error';
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ) => {
    setLogs((prev) =>
      [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          message,
          type,
        },
      ].slice(-10)
    ); // Keep only last 10 logs
  };

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch('/api/embeddings');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data);
      addLog('Status refreshed', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      addLog(`Error: ${message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEmbeddings = async (forceReindex = false) => {
    try {
      setIsProcessing(true);
      setError(null);
      addLog(
        forceReindex
          ? 'Force recreating embeddings...'
          : 'Creating embeddings...',
        'info'
      );

      const response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReindex }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create embeddings');
      }

      const result = await response.json();
      addLog(
        `Successfully processed ${result.stats?.documentsProcessed || 0} documents`,
        'success'
      );
      await fetchStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      addLog(`Error: ${message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearEmbeddings = async () => {
    if (
      !confirm(
        'Are you sure you want to clear all embeddings? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      addLog('Clearing all embeddings...', 'info');

      const response = await fetch('/api/embeddings', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear embeddings');
      }

      addLog('All embeddings cleared successfully', 'success');
      await fetchStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      addLog(`Error: ${message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusColor = () => {
    if (!status) return 'text-muted-foreground';
    return status.hasEmbeddings ? 'text-green-500' : 'text-yellow-500';
  };

  const getStatusIcon = () => {
    if (isLoading) return <Clock className="w-4 h-4" />;
    if (!status) return <AlertCircle className="w-4 h-4" />;
    return status.hasEmbeddings ? (
      <CheckCircle className="w-4 h-4" />
    ) : (
      <AlertCircle className="w-4 h-4" />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.div
        className="border-b border-sidebar-border bg-sidebar-background"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <Database className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-sidebar-foreground">
                  Embeddings Dashboard
                </h1>
                <p className="text-sm text-sidebar-foreground/60">
                  Manage vector embeddings for knowledge search
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* Status Card */}
          <motion.div
            className="bg-sidebar-background border border-sidebar-border rounded-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={getStatusColor()}>{getStatusIcon()}</div>
                <h2 className="text-lg font-semibold text-sidebar-foreground">
                  System Status
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStatus}
                disabled={isLoading}
                className="h-8"
              >
                <RefreshCw
                  className={`w-3 h-3 mr-2 ${isLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>

            {status && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-sidebar-accent rounded p-4">
                  <div className="text-2xl font-bold text-sidebar-foreground">
                    {status.hasEmbeddings
                      ? status.totalEmbeddings.toLocaleString()
                      : '0'}
                  </div>
                  <div className="text-sm text-sidebar-foreground/60">
                    Total Embeddings
                  </div>
                </div>
                <div className="bg-sidebar-accent rounded p-4">
                  <div className="text-2xl font-bold text-sidebar-foreground">
                    {status.indexSize}
                  </div>
                  <div className="text-sm text-sidebar-foreground/60">
                    Index Size
                  </div>
                </div>
                <div className="bg-sidebar-accent rounded p-4">
                  <div className="text-2xl font-bold text-sidebar-foreground">
                    {status.configuration.chunkSize}
                  </div>
                  <div className="text-sm text-sidebar-foreground/60">
                    Chunk Size
                  </div>
                </div>
                <div className="bg-sidebar-accent rounded p-4">
                  <div className="text-sm font-medium text-sidebar-foreground">
                    {status.lastUpdated
                      ? new Date(status.lastUpdated).toLocaleDateString()
                      : 'Never'}
                  </div>
                  <div className="text-sm text-sidebar-foreground/60">
                    Last Updated
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Actions */}
          <motion.div
            className="bg-sidebar-background border border-sidebar-border rounded-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <h2 className="text-lg font-semibold text-sidebar-foreground mb-4">
              Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleCreateEmbeddings(false)}
                disabled={isProcessing}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                {status?.hasEmbeddings
                  ? 'Update Embeddings'
                  : 'Create Embeddings'}
              </Button>

              <Button
                variant="outline"
                onClick={() => handleCreateEmbeddings(true)}
                disabled={isProcessing}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Force Recreate
              </Button>

              {status?.hasEmbeddings && (
                <Button
                  variant="outline"
                  onClick={handleClearEmbeddings}
                  disabled={isProcessing}
                  className="gap-2 text-red-400 border-red-400/20 hover:bg-red-400/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>
          </motion.div>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    {error}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setError(null)}
                      className="h-6 px-2 text-xs"
                    >
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Configuration */}
          {status && (
            <motion.div
              className="bg-sidebar-background border border-sidebar-border rounded-lg p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-sidebar-foreground" />
                <h2 className="text-lg font-semibold text-sidebar-foreground">
                  Configuration
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-sidebar-accent rounded p-4">
                  <div className="text-sm font-medium text-sidebar-foreground">
                    Embedding Model
                  </div>
                  <div className="text-sm text-sidebar-foreground/60 mt-1">
                    {status.configuration.model}
                  </div>
                </div>
                <div className="bg-sidebar-accent rounded p-4">
                  <div className="text-sm font-medium text-sidebar-foreground">
                    Chunk Size
                  </div>
                  <div className="text-sm text-sidebar-foreground/60 mt-1">
                    {status.configuration.chunkSize} tokens
                  </div>
                </div>
                <div className="bg-sidebar-accent rounded p-4">
                  <div className="text-sm font-medium text-sidebar-foreground">
                    Overlap
                  </div>
                  <div className="text-sm text-sidebar-foreground/60 mt-1">
                    {status.configuration.overlap} tokens
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Activity Logs */}
          <motion.div
            className="bg-sidebar-background border border-sidebar-border rounded-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-sidebar-foreground" />
              <h2 className="text-lg font-semibold text-sidebar-foreground">
                Activity Log
              </h2>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              <AnimatePresence>
                {logs.length === 0 ? (
                  <div className="text-sm text-sidebar-foreground/50 text-center py-4">
                    No activity yet
                  </div>
                ) : (
                  logs
                    .slice()
                    .reverse()
                    .map((log, index) => (
                      <motion.div
                        key={`${log.timestamp}-${index}`}
                        className="flex items-center gap-3 text-sm bg-sidebar-accent rounded p-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <Badge
                          variant={
                            log.type === 'success'
                              ? 'default'
                              : log.type === 'error'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {log.type}
                        </Badge>
                        <span className="text-sidebar-foreground/80 text-xs font-mono">
                          {log.timestamp}
                        </span>
                        <span className="text-sidebar-foreground flex-1">
                          {log.message}
                        </span>
                      </motion.div>
                    ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-sidebar-background border border-sidebar-border rounded-lg p-6 max-w-sm mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-sidebar-foreground" />
                <div>
                  <div className="font-medium text-sidebar-foreground">
                    Processing
                  </div>
                  <div className="text-sm text-sidebar-foreground/60">
                    Please wait...
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
