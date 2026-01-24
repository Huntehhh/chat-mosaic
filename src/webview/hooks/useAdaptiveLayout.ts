import { useState, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export type LayoutSize = 'narrow' | 'compact' | 'standard';

export interface AdaptiveLayoutState {
  layoutSize: LayoutSize;
  isNarrow: boolean;
  isCompact: boolean;
  width: number;
  height: number;
}

// =============================================================================
// Breakpoints (user preference: tighter 250/350)
// =============================================================================

const NARROW_BREAKPOINT = 250;
const COMPACT_BREAKPOINT = 350;

// =============================================================================
// Hook
// =============================================================================

/**
 * Adaptive layout hook using ResizeObserver
 * Returns layout state based on container width
 *
 * Breakpoints:
 * - narrow: < 250px (icon-only mode)
 * - compact: < 350px (condensed UI)
 * - standard: >= 350px (full UI)
 */
export function useAdaptiveLayout(): AdaptiveLayoutState {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 400,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  useEffect(() => {
    // Use ResizeObserver on document.body for accurate panel width
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(document.body);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Compute layout size based on width
  const layoutSize: LayoutSize =
    dimensions.width < NARROW_BREAKPOINT
      ? 'narrow'
      : dimensions.width < COMPACT_BREAKPOINT
        ? 'compact'
        : 'standard';

  return {
    layoutSize,
    isNarrow: dimensions.width < NARROW_BREAKPOINT,
    isCompact: dimensions.width < COMPACT_BREAKPOINT,
    width: dimensions.width,
    height: dimensions.height,
  };
}

// =============================================================================
// Utility: CSS class helper
// =============================================================================

/**
 * Returns CSS classes based on layout state
 * Usage: className={cn('base-class', layoutClasses(layout))}
 */
export function layoutClasses(layout: AdaptiveLayoutState): string {
  const classes: string[] = [];

  if (layout.isNarrow) {
    classes.push('layout-narrow');
  } else if (layout.isCompact) {
    classes.push('layout-compact');
  } else {
    classes.push('layout-standard');
  }

  return classes.join(' ');
}
