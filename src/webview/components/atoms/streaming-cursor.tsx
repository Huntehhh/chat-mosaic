/**
 * StreamingCursor - Blinking cursor shown at end of streaming text
 */
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { blinkVariants } from '../../lib/animations';

export interface StreamingCursorProps {
  className?: string;
}

export const StreamingCursor = React.forwardRef<HTMLSpanElement, StreamingCursorProps>(
  ({ className }, ref) => {
    return (
      <motion.span
        ref={ref}
        className={cn('inline-block w-0.5 h-4 bg-[#fafafa] ml-0.5', className)}
        variants={blinkVariants}
        animate="animate"
      />
    );
  }
);

StreamingCursor.displayName = 'StreamingCursor';
