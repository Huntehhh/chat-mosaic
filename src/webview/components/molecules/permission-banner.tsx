/**
 * PermissionBanner - Bottom sticky banner for permission requests
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { slideFromBottom, springTransition } from '../../lib/animations';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

export interface Permission {
  id: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface PermissionBannerProps {
  permission: Permission | null;
  onApprove: () => void;
  onDeny: () => void;
  className?: string;
}

/**
 * Format tool input for display (truncate to 100 chars)
 */
function formatInput(input: Record<string, unknown>): string {
  // Extract the most relevant field based on common tool patterns
  const command = input.command as string | undefined;
  const filePath = input.file_path as string | undefined;
  const pattern = input.pattern as string | undefined;

  let display = command || filePath || pattern || JSON.stringify(input);

  if (display.length > 100) {
    display = display.slice(0, 97) + '...';
  }

  return display;
}

export const PermissionBanner = React.forwardRef<HTMLDivElement, PermissionBannerProps>(
  ({ permission, onApprove, onDeny, className }, ref) => {
    return (
      <AnimatePresence>
        {permission && (
          <motion.div
            ref={ref}
            variants={slideFromBottom}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
            className={cn(
              'fixed bottom-20 left-4 right-4 z-50',
              'bg-yellow-500/10 border border-yellow-500/50 rounded-lg',
              'p-4 shadow-lg backdrop-blur-sm',
              className
            )}
          >
            <div className="flex items-start gap-3">
              {/* Warning icon */}
              <Icon
                name="warning"
                className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5"
                fill
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#fafafa]">
                  Permission Required
                </p>
                <p className="text-xs text-[#8b8b94] mt-1 font-mono truncate">
                  {permission.tool}: {formatInput(permission.input)}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDeny}
                >
                  Deny
                </Button>
                <Button
                  size="sm"
                  onClick={onApprove}
                >
                  Allow
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

PermissionBanner.displayName = 'PermissionBanner';
