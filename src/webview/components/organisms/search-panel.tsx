'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface SearchResult {
  /** Message index in the messages array */
  messageIndex: number;
  /** Matched text snippet with context */
  snippet: string;
  /** Type of message */
  type: 'user' | 'claude' | 'tool-use' | 'tool-result' | 'system' | 'thinking';
  /** Original timestamp */
  timestamp: number;
  /** Tool name if applicable */
  toolName?: string;
  /** Match count within this message */
  matchCount: number;
}

export interface SearchPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onClose?: () => void;
  /** Search query */
  searchQuery?: string;
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void;
  /** Search results */
  results?: SearchResult[];
  /** Whether search is in progress */
  isSearching?: boolean;
  /** Total match count across all results */
  totalMatches?: number;
  /** Currently highlighted result index */
  currentResultIndex?: number;
  /** Callback when a result is selected */
  onSelectResult?: (result: SearchResult) => void;
  /** Callback to navigate to next result */
  onNextResult?: () => void;
  /** Callback to navigate to previous result */
  onPrevResult?: () => void;
}

/**
 * Format relative timestamp
 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Get icon for message type
 */
function getTypeIcon(type: SearchResult['type']): string {
  switch (type) {
    case 'user':
      return 'person';
    case 'claude':
      return 'smart_toy';
    case 'tool-use':
      return 'build';
    case 'tool-result':
      return 'output';
    case 'system':
      return 'info';
    case 'thinking':
      return 'psychology';
    default:
      return 'chat';
  }
}

const SearchPanel = React.forwardRef<HTMLDivElement, SearchPanelProps>(
  (
    {
      className,
      open = false,
      onClose,
      searchQuery = '',
      onSearchChange,
      results = [],
      isSearching = false,
      totalMatches = 0,
      currentResultIndex = -1,
      onSelectResult,
      onNextResult,
      onPrevResult,
      ...props
    },
    ref
  ) => {
    // Accessibility
    const titleId = React.useId();
    const focusTrapRef = useFocusTrap(open);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Focus input when panel opens
    React.useEffect(() => {
      if (open && inputRef.current) {
        inputRef.current.focus();
      }
    }, [open]);

    // Handle keyboard shortcuts
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          onPrevResult?.();
        } else {
          onNextResult?.();
        }
        e.preventDefault();
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    }, [onNextResult, onPrevResult, onClose]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <div
          ref={(node) => {
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
            (focusTrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            'animate-slide-in flex flex-col w-[360px] h-full bg-[#0f0f0f]',
            'border-l border-[#222225]',
            'shadow-[-4px_0_16px_rgba(0,0,0,0.3),inset_1px_0_0_0_rgba(255,255,255,0.03)]',
            className
          )}
          {...props}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[#222225]">
            <h2 id={titleId} className="text-[16px] font-semibold text-white tracking-tight">
              Search in Conversation
            </h2>
            <button
              type="button"
              className="flex items-center justify-center size-8 rounded hover:bg-[#171717] text-[#8b8b94] transition-colors cursor-pointer group"
              onClick={onClose}
            >
              <Icon
                name="close"
                size="sm"
                className="group-hover:text-white transition-colors"
              />
            </button>
          </div>

          {/* Search Input */}
          <div className="px-3 py-3 shrink-0 border-b border-[#222225]">
            <div className="flex items-center w-full h-10 bg-[#171717] rounded border border-[#222225] focus-within:border-[#FFA344]/50 focus-within:ring-1 focus-within:ring-[#FFA344]/20 transition-all">
              <Icon name="search" className="text-[#8b8b94] pl-2.5 !text-[18px]" />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent border-none text-[13px] text-white placeholder-[#52525b] focus:ring-0 h-full py-1 pl-2 pr-2"
                placeholder="Search messages..."
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {/* Navigation buttons */}
              {searchQuery && results.length > 0 && (
                <div className="flex items-center pr-2 gap-1">
                  <span className="text-[11px] text-[#8b8b94] mr-1">
                    {currentResultIndex >= 0 ? currentResultIndex + 1 : 0}/{results.length}
                  </span>
                  <button
                    type="button"
                    onClick={onPrevResult}
                    className="p-1 rounded hover:bg-[#222] text-[#8b8b94] hover:text-white transition-colors"
                    title="Previous (Shift+Enter)"
                  >
                    <Icon name="keyboard_arrow_up" className="!text-[16px]" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextResult}
                    className="p-1 rounded hover:bg-[#222] text-[#8b8b94] hover:text-white transition-colors"
                    title="Next (Enter)"
                  >
                    <Icon name="keyboard_arrow_down" className="!text-[16px]" />
                  </button>
                </div>
              )}
            </div>
            {/* Search stats */}
            {searchQuery && !isSearching && (
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[11px] text-[#52525b]">
                  {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} in {results.length} {results.length === 1 ? 'message' : 'messages'}
                </span>
                {results.length > 0 && (
                  <span className="text-[10px] text-[#52525b]">
                    Enter/Shift+Enter to navigate
                  </span>
                )}
              </div>
            )}
            {isSearching && (
              <div className="flex items-center gap-2 mt-2 px-1">
                <Icon name="hourglass_empty" className="text-[#FFA344] !text-[14px] animate-spin" />
                <span className="text-[11px] text-[#8b8b94]">Searching...</span>
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto">
            {!searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full px-4 text-center">
                <Icon name="search" className="text-[#52525b] !text-[32px] mb-2" />
                <p className="text-[13px] text-[#52525b]">
                  Type to search within this conversation
                </p>
                <p className="text-[11px] text-[#3f3f46] mt-1">
                  Searches through all messages, tool outputs, and thinking
                </p>
              </div>
            ) : results.length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center h-full px-4 text-center">
                <Icon name="search_off" className="text-[#52525b] !text-[32px] mb-2" />
                <p className="text-[13px] text-[#52525b]">
                  No matches found
                </p>
                <p className="text-[11px] text-[#3f3f46] mt-1">
                  Try different keywords
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#222225]">
                {results.map((result, index) => (
                  <button
                    key={`${result.messageIndex}-${index}`}
                    type="button"
                    onClick={() => onSelectResult?.(result)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-[#171717] transition-colors',
                      currentResultIndex === index && 'bg-[#1a1a1a] border-l-2 border-[#FFA344]'
                    )}
                  >
                    {/* Result header */}
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        name={getTypeIcon(result.type)}
                        className={cn(
                          '!text-[14px]',
                          result.type === 'user' ? 'text-[#60a5fa]' :
                          result.type === 'claude' ? 'text-[#FFA344]' :
                          result.type === 'tool-use' ? 'text-[#a78bfa]' :
                          result.type === 'tool-result' ? 'text-[#34d399]' :
                          'text-[#8b8b94]'
                        )}
                      />
                      <span className="text-[11px] font-medium text-[#8b8b94] capitalize">
                        {result.type === 'tool-use' && result.toolName
                          ? result.toolName
                          : result.type.replace('-', ' ')}
                      </span>
                      <span className="text-[10px] text-[#52525b]">
                        {formatRelativeTime(result.timestamp)}
                      </span>
                      {result.matchCount > 1 && (
                        <span className="ml-auto text-[10px] bg-[#222] text-[#8b8b94] px-1.5 py-0.5 rounded">
                          {result.matchCount} matches
                        </span>
                      )}
                    </div>
                    {/* Snippet */}
                    <p className="text-[12px] text-[#a1a1aa] line-clamp-2 leading-relaxed">
                      {result.snippet}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

SearchPanel.displayName = 'SearchPanel';

export { SearchPanel };
