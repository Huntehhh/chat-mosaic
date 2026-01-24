/**
 * ToolOutputSkeleton - Animated placeholder while tool is executing
 */
import React from 'react';
import { cn } from '../../lib/utils';

export interface ToolOutputSkeletonProps {
  /** Number of content lines to show (default: 3) */
  lines?: number;
  className?: string;
}

export const ToolOutputSkeleton = React.forwardRef<HTMLDivElement, ToolOutputSkeletonProps>(
  ({ lines = 3, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-[#222225] bg-[#171717]/30 p-3 animate-pulse',
          className
        )}
      >
        {/* Header: icon + title placeholder */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded bg-[#8b8b94]/20" />
          <div className="h-4 w-32 rounded bg-[#8b8b94]/20" />
        </div>

        {/* Content lines */}
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-[#8b8b94]/10"
              style={{
                width: `${100 - i * 15}%`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
);

ToolOutputSkeleton.displayName = 'ToolOutputSkeleton';
