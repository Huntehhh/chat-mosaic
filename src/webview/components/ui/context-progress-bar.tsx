'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// Types
// =============================================================================

export type ContextLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ContextProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current context usage percentage (0-100) */
  percentage: number;
  /** Context level for color coding */
  level?: ContextLevel;
  /** Whether the bar is currently streaming/active */
  isStreaming?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const TICK_POSITIONS = [25, 50, 75] as const;

/**
 * Color scheme based on user requirements:
 * - Green (low): 0-50%
 * - Yellow (medium): 50-75%
 * - Red (high/critical): 75-100%
 */
const LEVEL_COLORS: Record<ContextLevel, { fill: string; glow: string }> = {
  low: {
    fill: '#22c55e', // green-500
    glow: 'shadow-[0_0_6px_rgba(34,197,94,0.5)]',
  },
  medium: {
    fill: '#eab308', // yellow-500
    glow: 'shadow-[0_0_6px_rgba(234,179,8,0.5)]',
  },
  high: {
    fill: '#ef4444', // red-500
    glow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]',
  },
  critical: {
    fill: '#dc2626', // red-600
    glow: 'shadow-[0_0_8px_rgba(220,38,38,0.6)]',
  },
};

// =============================================================================
// ContextProgressBar Component
// =============================================================================

const ContextProgressBar = React.forwardRef<HTMLDivElement, ContextProgressBarProps>(
  (
    {
      className,
      percentage,
      level = 'low',
      isStreaming = false,
      ...props
    },
    ref
  ) => {
    // Clamp percentage to 0-100
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    const colors = LEVEL_COLORS[level];

    return (
      <div
        ref={ref}
        className={cn(
          'relative self-center mb-[14px]', // margin-bottom to make room for numbers below
          className
        )}
        title={`Context: ${Math.round(clampedPercentage)}%`}
        {...props}
      >
        {/* Bar with tick lines extending through and below */}
        <div
          className={cn(
            'relative w-[120px] h-[14px] bg-[#1a1a1a] border border-[#333] overflow-visible',
            isStreaming && colors.glow
          )}
        >
          {/* Progress fill */}
          <div
            className={cn(
              'absolute inset-y-0 left-0 transition-all duration-300',
              isStreaming && 'animate-pulse'
            )}
            style={{
              width: `${clampedPercentage}%`,
              backgroundColor: colors.fill,
            }}
          />

          {/* Tick lines - only within the bar */}
          {TICK_POSITIONS.map((tick) => (
            <div
              key={tick}
              className="absolute w-px bg-[#666] top-0 bottom-0"
              style={{ left: `${tick}%` }}
            />
          ))}

          {/* Tick numbers - positioned right below the bar */}
          {TICK_POSITIONS.map((tick) => (
            <span
              key={`label-${tick}`}
              className="absolute text-[10px] font-mono leading-none select-none text-white"
              style={{
                left: `${tick}%`,
                top: '16px', // just below the 14px bar + 2px gap
                transform: 'translateX(-50%)',
              }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>
    );
  }
);

ContextProgressBar.displayName = 'ContextProgressBar';

export { ContextProgressBar };
