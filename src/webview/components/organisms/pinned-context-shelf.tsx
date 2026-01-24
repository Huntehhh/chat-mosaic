/**
 * PinnedContextShelf - Drag-and-drop file pinning for persistent context
 *
 * UI-only component. Backend wiring handled separately.
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { fadeInUp, staggerContainer, staggerItem, smoothTransition } from '../../lib/animations';
import { Badge } from '../ui/badge';
import { Icon } from '../ui/icon';

export interface PinnedFile {
  path: string;
  name: string;
  tokens?: number;
}

export interface PinnedContextShelfProps {
  pinnedFiles: PinnedFile[];
  onDrop?: (paths: string[]) => void;
  onUnpin?: (path: string) => void;
  className?: string;
}

/**
 * Format token count for display (e.g., 1234 -> "1.2k")
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export const PinnedContextShelf = React.forwardRef<HTMLDivElement, PinnedContextShelfProps>(
  ({ pinnedFiles, onDrop, onUnpin, className }, ref) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // Try to get file paths from various drag data formats
      const uriList = e.dataTransfer?.getData('text/uri-list');
      const text = e.dataTransfer?.getData('text/plain');

      let paths: string[] = [];

      if (uriList) {
        paths = uriList.split('\n').filter(Boolean);
      } else if (text) {
        paths = text.split('\n').filter(Boolean);
      }

      if (paths.length > 0) {
        onDrop?.(paths);
      }
    }, [onDrop]);

    const isEmpty = pinnedFiles.length === 0;

    return (
      <div
        ref={ref}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'sticky top-0 z-10 bg-[#09090b]/95 backdrop-blur border-b p-2',
          'transition-colors duration-150',
          isDragOver && 'border-[#FFA344] bg-[#FFA344]/5',
          isEmpty ? 'border-dashed border-[#222225]' : 'border-[#222225]',
          className
        )}
      >
        <AnimatePresence mode="wait">
          {isEmpty ? (
            // Empty state
            <motion.div
              key="empty"
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={smoothTransition}
              className="flex items-center justify-center gap-2 py-2"
            >
              <Icon
                name="attach_file"
                className={cn(
                  'w-4 h-4',
                  isDragOver ? 'text-[#FFA344]' : 'text-[#52525b]'
                )}
              />
              <p className={cn(
                'text-xs',
                isDragOver ? 'text-[#FFA344]' : 'text-[#52525b]'
              )}>
                {isDragOver ? 'Drop to pin files' : 'Drag files here to pin context'}
              </p>
            </motion.div>
          ) : (
            // Pinned files list
            <motion.div
              key="files"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-wrap gap-1"
            >
              {pinnedFiles.map((file) => (
                <motion.div
                  key={file.path}
                  variants={staggerItem}
                  transition={smoothTransition}
                  layout
                >
                  <Badge
                    variant="secondary"
                    className="gap-1 pr-1 group"
                  >
                    <Icon name="description" className="w-3 h-3" />
                    <span className="truncate max-w-[120px]" title={file.path}>
                      {file.name}
                    </span>
                    {file.tokens !== undefined && (
                      <span className="text-[#52525b] text-[10px]">
                        ({formatTokens(file.tokens)})
                      </span>
                    )}
                    <button
                      onClick={() => onUnpin?.(file.path)}
                      className="ml-1 p-0.5 rounded hover:bg-white/10 opacity-50 group-hover:opacity-100 transition-opacity"
                      title="Unpin file"
                    >
                      <Icon name="close" className="w-3 h-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

PinnedContextShelf.displayName = 'PinnedContextShelf';
