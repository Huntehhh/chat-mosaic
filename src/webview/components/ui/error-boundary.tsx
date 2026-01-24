'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icon } from './icon';
import { Button } from './button';

// =============================================================================
// Types
// =============================================================================

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// =============================================================================
// ErrorBoundary Component
// =============================================================================

/**
 * ErrorBoundary - Catches JavaScript errors in child component tree
 *
 * Provides crash protection for the React app, displaying a fallback UI
 * when an error occurs instead of crashing the entire application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-[#0f0f0f] border border-[#222225] rounded-lg m-4"
        >
          <Icon
            name="error"
            className="!text-[32px] text-red-500/80 mb-3"
          />
          <h2 className="text-[16px] font-semibold text-[#fafafa] mb-2">
            Something went wrong
          </h2>
          <p className="text-[13px] text-[#8b8b94] mb-4 text-center max-w-[280px]">
            An unexpected error occurred. Try refreshing or click below to recover.
          </p>

          {/* Error details (collapsible) */}
          <details className="w-full max-w-[320px] mb-4">
            <summary className="text-[12px] text-[#52525b] cursor-pointer hover:text-[#8b8b94] transition-colors">
              View error details
            </summary>
            <pre className="mt-2 p-3 bg-[#171717] border border-[#222225] rounded text-[11px] text-red-400/80 font-mono overflow-x-auto whitespace-pre-wrap break-words">
              {this.state.error?.message || 'Unknown error'}
              {this.state.error?.stack && (
                <>
                  {'\n\n'}
                  {this.state.error.stack}
                </>
              )}
            </pre>
          </details>

          <Button
            variant="secondary"
            size="sm"
            onClick={this.handleReset}
            className="gap-2"
          >
            <Icon name="refresh" className="!text-[16px]" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
