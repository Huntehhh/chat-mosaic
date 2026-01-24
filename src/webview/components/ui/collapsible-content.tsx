'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './icon';

export interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to display (can be string or React node) */
  children: React.ReactNode;
  /** Maximum lines to show when collapsed */
  maxLines?: number;
  /** Whether content is initially expanded */
  defaultExpanded?: boolean;
  /** Optional label (e.g., "IN", "OUT") */
  label?: string;
  /** Whether content is an error (applies error styling) */
  isError?: boolean;
  /** Whether to use monospace font */
  mono?: boolean;
  /** Whether to lazy-load content (defer rendering until expanded) */
  lazyLoad?: boolean;
  /** Callback when expanded state changes */
  onExpandChange?: (expanded: boolean) => void;
}

/**
 * Truncate text to N lines
 */
function truncateLines(text: string, maxLines: number): {
  text: string;
  truncated: boolean;
  lineCount: number;
} {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, truncated: false, lineCount: lines.length };
  }
  return {
    text: lines.slice(0, maxLines).join('\n'),
    truncated: true,
    lineCount: lines.length,
  };
}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({
    className,
    children,
    maxLines = 5,
    defaultExpanded = false,
    label,
    isError = false,
    mono = true,
    lazyLoad = false,
    onExpandChange,
    ...props
  }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
    const [hasRendered, setHasRendered] = React.useState(!lazyLoad || defaultExpanded);

    // Get text content for truncation calculation
    const textContent = typeof children === 'string' ? children : '';
    const { text: preview, truncated, lineCount } = truncateLines(textContent, maxLines);

    // Handle lazy loading - render content after first expand
    React.useEffect(() => {
      if (isExpanded && lazyLoad && !hasRendered) {
        setHasRendered(true);
      }
    }, [isExpanded, lazyLoad, hasRendered]);

    const handleToggle = React.useCallback(() => {
      const newExpanded = !isExpanded;
      setIsExpanded(newExpanded);
      onExpandChange?.(newExpanded);
    }, [isExpanded, onExpandChange]);

    // If not truncated and not lazy loading, just show content directly
    if (!truncated && !lazyLoad) {
      return (
        <div ref={ref} className={cn('flex items-start gap-2', className)} {...props}>
          {label && (
            <span className="text-[10px] font-mono text-[#52525b] select-none shrink-0 w-6 pt-0.5">
              {label}
            </span>
          )}
          <div className="flex-1 min-w-0">
            {typeof children === 'string' ? (
              <pre
                className={cn(
                  'text-[11px] whitespace-pre-wrap break-all leading-relaxed',
                  mono && 'font-mono',
                  isError ? 'text-[#ffa198]' : 'text-[#8b8b94]'
                )}
              >
                {children}
              </pre>
            ) : (
              children
            )}
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('flex items-start gap-2', className)} {...props}>
        {label && (
          <span className="text-[10px] font-mono text-[#52525b] select-none shrink-0 w-6 pt-0.5">
            {label}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={handleToggle}
            className="w-full text-left cursor-pointer group"
          >
            {typeof children === 'string' ? (
              <pre
                className={cn(
                  'text-[11px] whitespace-pre-wrap break-all leading-relaxed',
                  mono && 'font-mono',
                  isError ? 'text-[#ffa198]' : 'text-[#8b8b94]'
                )}
                style={!isExpanded && truncated ? {
                  display: '-webkit-box',
                  WebkitLineClamp: maxLines,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                } : undefined}
              >
                {/* Lazy load: only render full content after expanded once */}
                {lazyLoad && !hasRendered ? preview : (isExpanded ? children : preview)}
                {!isExpanded && truncated && (
                  <span className="text-[#52525b] group-hover:text-[#8b8b94]"> ...</span>
                )}
              </pre>
            ) : (
              /* For React node children (e.g., Markdown), render directly */
              <>
                <div className={cn(!isExpanded && 'max-h-[100px] overflow-hidden')}>
                  {(lazyLoad && !hasRendered) ? null : children}
                </div>
                {!isExpanded && truncated && (
                  <span className="text-[10px] text-[#52525b] group-hover:text-[#8b8b94]">...</span>
                )}
              </>
            )}
          </button>
        </div>
        {/* Expand/collapse button */}
        <button
          type="button"
          onClick={handleToggle}
          className="shrink-0"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          aria-expanded={isExpanded}
        >
          <Icon
            name={isExpanded ? 'expand_less' : 'expand_more'}
            className="text-[#52525b] hover:text-[#8b8b94] !text-[14px]"
          />
        </button>
      </div>
    );
  }
);

CollapsibleContent.displayName = 'CollapsibleContent';

export { CollapsibleContent };
