/**
 * ThinkingBlock - Collapsible accordion for thinking/reasoning content
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { smoothTransition, pulseVariants } from '../../lib/animations';
import { Icon } from '../ui/icon';

export interface ThinkingBlockProps {
  content: string;
  isExpanded?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  className?: string;
}

export const ThinkingBlock = React.forwardRef<HTMLDivElement, ThinkingBlockProps>(
  ({ content, isExpanded: controlledExpanded, defaultExpanded = false, onToggle, className }, ref) => {
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

    // Support both controlled and uncontrolled modes
    const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

    const handleToggle = () => {
      const newExpanded = !isExpanded;
      if (controlledExpanded === undefined) {
        setInternalExpanded(newExpanded);
      }
      onToggle?.(newExpanded);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'border-l-4 border-amber-500 bg-amber-500/5 rounded-r-lg overflow-hidden',
          className
        )}
      >
        {/* Header - always visible */}
        <button
          onClick={handleToggle}
          className="w-full flex items-center gap-2 p-3 text-left hover:bg-amber-500/10 transition-colors"
        >
          {/* Pulsing indicator */}
          <motion.span
            className="w-2 h-2 rounded-full bg-amber-500"
            variants={pulseVariants}
            animate="animate"
          />

          <span className="text-sm text-[#8b8b94] font-medium">Thinking...</span>

          {/* Expand/collapse icon */}
          <motion.span
            className="ml-auto"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={smoothTransition}
          >
            <Icon name="expand_more" className="w-4 h-4 text-[#8b8b94]" />
          </motion.span>
        </button>

        {/* Content - animated expand/collapse */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={smoothTransition}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-0">
                <p className="text-xs font-mono text-[#8b8b94] italic whitespace-pre-wrap">
                  {content}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

ThinkingBlock.displayName = 'ThinkingBlock';
