/**
 * FileDiffView - Wrapper around DiffView with file header
 */
import React from 'react';
import { cn } from '../../lib/utils';
import { DiffView } from './diff-view';
import { Icon } from '../ui/icon';

export interface FileDiffViewProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  /** View mode - currently only unified supported by underlying DiffView */
  viewType?: 'split' | 'unified';
  /** Whether to show the diff collapsed by default */
  defaultCollapsed?: boolean;
  className?: string;
}

export const FileDiffView = React.forwardRef<HTMLDivElement, FileDiffViewProps>(
  ({ filePath, oldContent, newContent, viewType = 'unified', defaultCollapsed, className }, ref) => {
    // Extract filename from path for display
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-[#222225] overflow-hidden',
          className
        )}
      >
        {/* File path header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#171717] border-b border-[#222225]">
          <Icon name="description" className="w-4 h-4 text-[#8b8b94]" />
          <span className="text-sm font-medium text-[#fafafa] truncate" title={filePath}>
            {fileName}
          </span>
          <span className="text-xs text-[#52525b] truncate hidden sm:block">
            {filePath !== fileName && filePath}
          </span>
        </div>

        {/* Diff content */}
        <DiffView
          oldContent={oldContent}
          newContent={newContent}
          defaultCollapsed={defaultCollapsed}
        />
      </div>
    );
  }
);

FileDiffView.displayName = 'FileDiffView';
