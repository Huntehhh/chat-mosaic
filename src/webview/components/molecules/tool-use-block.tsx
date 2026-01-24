'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/icon';
import { DiffView, type DiffLine } from './diff-view';
import { MarkdownRenderer } from '../../lib/markdown';
import { formatMcpInput, formatMcpOutput } from '../../lib/mcp-formatter';

// Tool icon mapping
const toolIcons: Record<string, string> = {
  Read: 'description',
  read: 'description',
  Write: 'edit_document',
  write: 'edit_document',
  Edit: 'edit',
  edit: 'edit',
  Bash: 'terminal',
  bash: 'terminal',
  Grep: 'search',
  grep: 'search',
  Glob: 'folder_open',
  glob: 'folder_open',
  Task: 'task',
  task: 'task',
  default: 'build',
};

export interface ToolUseBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  toolName: string;
  input?: Record<string, unknown> | string;
  output?: string;
  isError?: boolean;
  filePath?: string;
  /** For Edit operations - old content before edit */
  oldContent?: string;
  /** For Edit operations - new content after edit */
  newContent?: string;
  /** Callback when a file path is clicked */
  onOpenFile?: (filePath: string) => void;
}

/**
 * Get description label for tool (used as subtitle in header)
 */
function getToolDescription(toolName: string, input: Record<string, unknown> | string | undefined): string | undefined {
  if (!input || typeof input === 'string') return undefined;

  const lowerName = toolName.toLowerCase();

  // Bash shows description as header label
  if (lowerName === 'bash' && input.description) {
    return input.description as string;
  }

  return undefined;
}

/**
 * Format input for display - extract the most relevant info
 */
function formatInput(toolName: string, input: Record<string, unknown> | string | undefined, isMcp: boolean): string {
  if (!input) return '';
  if (typeof input === 'string') return input;

  const lowerName = toolName.toLowerCase();

  if (lowerName === 'bash') {
    return input.command as string || '';
  }
  if (lowerName === 'grep') {
    const pattern = input.pattern as string || '';
    const path = input.path as string || '.';
    return `${pattern} in ${path}`;
  }
  if (lowerName === 'glob') {
    return input.pattern as string || '';
  }

  // MCP tools - format as Markdown
  if (isMcp) {
    return formatMcpInput(input);
  }

  // Other tools - show formatted JSON
  return JSON.stringify(input, null, 2);
}

/**
 * Get file path from tool input for header display
 */
function getFilePath(toolName: string, input: Record<string, unknown> | string | undefined, explicitFilePath?: string): string | undefined {
  if (explicitFilePath) return explicitFilePath;
  if (!input || typeof input === 'string') return undefined;

  const lowerName = toolName.toLowerCase();
  if (lowerName === 'read' || lowerName === 'write' || lowerName === 'edit') {
    return input.file_path as string || input.path as string || undefined;
  }
  return undefined;
}

/**
 * Truncate text to N lines
 */
function truncateLines(text: string, maxLines: number): { text: string; truncated: boolean; lineCount: number } {
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

/**
 * Compute diff lines from old and new strings
 */
function computeDiffLines(oldStr: string, newStr: string): { lines: DiffLine[]; additions: number; deletions: number } {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const result: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  let lineNum = 1;

  // Find common prefix
  let commonPrefixLen = 0;
  while (commonPrefixLen < oldLines.length && commonPrefixLen < newLines.length &&
         oldLines[commonPrefixLen] === newLines[commonPrefixLen]) {
    result.push({ type: 'context', lineNumber: lineNum, content: oldLines[commonPrefixLen] });
    commonPrefixLen++;
    lineNum++;
  }

  // Mark remaining old lines as removed
  for (let i = commonPrefixLen; i < oldLines.length; i++) {
    result.push({ type: 'remove', lineNumber: lineNum, content: oldLines[i] });
    deletions++;
  }

  // Mark remaining new lines as added
  for (let i = commonPrefixLen; i < newLines.length; i++) {
    result.push({ type: 'add', newLineNumber: lineNum, content: newLines[i] });
    additions++;
    lineNum++;
  }

  return { lines: result, additions, deletions };
}

const ToolUseBlock = React.forwardRef<HTMLDivElement, ToolUseBlockProps>(
  ({
    className,
    toolName,
    input,
    output,
    isError = false,
    filePath,
    oldContent,
    newContent,
    onOpenFile,
    ...props
  }, ref) => {
    const [inExpanded, setInExpanded] = React.useState(false);
    const [outExpanded, setOutExpanded] = React.useState(false);

    // Get icon for tool
    const icon = toolIcons[toolName] || toolIcons.default;
    const lowerName = toolName.toLowerCase();

    // Check if this is an MCP tool
    const isMcp = toolName.startsWith('mcp_') || toolName.startsWith('mcp__');
    const isBash = lowerName === 'bash';
    const isRead = lowerName === 'read';
    const isWrite = lowerName === 'write';
    const isEditTool = lowerName === 'edit' || lowerName === 'multiedit';

    // Only show diff for Edit tools
    const hasFullDiff = isEditTool && oldContent !== undefined && newContent !== undefined && oldContent !== newContent;

    // Extract old_string/new_string from input for inline diff display
    const editOldString = isEditTool && input && typeof input === 'object'
      ? (input as Record<string, unknown>).old_string as string | undefined
      : undefined;
    const editNewString = isEditTool && input && typeof input === 'object'
      ? (input as Record<string, unknown>).new_string as string | undefined
      : undefined;
    const hasInlineDiff = isEditTool && editOldString !== undefined && editNewString !== undefined;

    // Compute diff if needed
    const diffData = React.useMemo(() => {
      if (hasFullDiff) {
        return computeDiffLines(oldContent!, newContent!);
      }
      if (hasInlineDiff && editOldString && editNewString) {
        return computeDiffLines(editOldString, editNewString);
      }
      return null;
    }, [hasFullDiff, hasInlineDiff, oldContent, newContent, editOldString, editNewString]);

    // Get description label for header (e.g., Bash descriptions)
    const descriptionLabel = getToolDescription(toolName, input);

    // Get file path for header display
    const headerFilePath = getFilePath(toolName, input, filePath);

    // Format input for display
    const formattedInput = formatInput(toolName, input, isMcp);

    // Preview lines: 1 for Bash, 2 for MCP, 0 for Read
    const inPreviewLines = isBash ? 1 : (isMcp ? 2 : 2);
    const outPreviewLines = 1;

    const { text: inPreview, truncated: inTruncated, lineCount: inLineCount } = truncateLines(formattedInput, inPreviewLines);

    // Format output - use MCP formatter for MCP tools
    const outputText = output || '';
    const formattedOutput = React.useMemo(() => {
      if (isMcp && outputText) {
        return formatMcpOutput(outputText);
      }
      return outputText;
    }, [isMcp, outputText]);

    const { text: outPreview, truncated: outTruncated, lineCount: outLineCount } = truncateLines(
      isMcp ? formattedOutput : outputText,
      outPreviewLines
    );

    // Render DiffView for Edit operations with diff data
    if ((hasFullDiff || hasInlineDiff) && diffData) {
      return (
        <DiffView
          ref={ref}
          className={className}
          filename={headerFilePath || filePath || 'unknown'}
          lines={diffData.lines}
          additions={diffData.additions}
          deletions={diffData.deletions}
          defaultOpen={true}
          maxPreviewLines={15}
          onOpenFile={onOpenFile}
          {...props}
        />
      );
    }

    // Should we show IN section?
    const showIn = !isRead && formattedInput;

    // Should we show OUT section?
    const showOut = outputText.length > 0;

    return (
      <div
        ref={ref}
        className={cn('flex gap-2', className)}
        {...props}
      >
        {/* Content */}
        <div className="flex flex-col gap-0.5 w-full min-w-0 ml-2">
          {/* Tool name header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#FFA344] select-none">•</span>
            <Icon name={isMcp ? 'memory' : icon} className="text-[#8b8b94] !text-[14px]" />
            <span className="text-[13px] font-medium text-[#fafafa]">
              {toolName}
            </span>
            {descriptionLabel && (
              <span className="text-[12px] text-[#a1a1aa]">
                {descriptionLabel}
              </span>
            )}
            {headerFilePath && !descriptionLabel && (
              <button
                type="button"
                onClick={() => onOpenFile?.(headerFilePath)}
                className="text-[11px] text-[#FFA344] truncate hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                {headerFilePath}
              </button>
            )}
          </div>

          {/* IN section */}
          {showIn && (
            <div className="ml-5 flex items-start gap-2">
              <span className="text-[10px] font-mono text-[#52525b] select-none shrink-0 w-6 pt-0.5">IN</span>
              <div className="flex-1 min-w-0">
                {isMcp && inExpanded ? (
                  /* MCP expanded: render as Markdown with smaller text */
                  <button
                    type="button"
                    onClick={() => setInExpanded(false)}
                    className="w-full text-left cursor-pointer"
                  >
                    <div className="mcp-content mcp-content-small">
                      <MarkdownRenderer content={formattedInput} />
                    </div>
                  </button>
                ) : (
                  /* Non-MCP or collapsed: render as pre */
                  <button
                    type="button"
                    onClick={() => inTruncated && setInExpanded(!inExpanded)}
                    className={cn(
                      "w-full text-left",
                      inTruncated && "cursor-pointer group"
                    )}
                    disabled={!inTruncated}
                  >
                    <pre className={cn(
                      'text-[11px] font-mono text-[#8b8b94] whitespace-pre-wrap break-all leading-relaxed',
                      !inExpanded && inTruncated && (isBash ? 'line-clamp-1' : 'line-clamp-2')
                    )}>
                      {inExpanded ? formattedInput : inPreview}
                      {!inExpanded && inTruncated && (
                        <span className="text-[#52525b] group-hover:text-[#8b8b94]"> ...</span>
                      )}
                    </pre>
                  </button>
                )}
              </div>
              {(inTruncated || (isMcp && inExpanded)) && (
                <button
                  type="button"
                  onClick={() => setInExpanded(!inExpanded)}
                  className="shrink-0"
                >
                  <Icon
                    name={inExpanded ? 'expand_less' : 'expand_more'}
                    className="text-[#52525b] hover:text-[#8b8b94] !text-[14px]"
                  />
                </button>
              )}
            </div>
          )}

          {/* OUT section */}
          {showOut && (
            <div className="ml-5 flex items-start gap-2">
              <span className="text-[10px] font-mono text-[#52525b] select-none shrink-0 w-6 pt-0.5">OUT</span>
              <div className="flex-1 min-w-0">
                {isMcp && outExpanded ? (
                  /* MCP expanded: render as Markdown with smaller text */
                  <button
                    type="button"
                    onClick={() => setOutExpanded(false)}
                    className="w-full text-left cursor-pointer"
                  >
                    <div className={cn("mcp-content mcp-content-small", isError && "mcp-content-error")}>
                      <MarkdownRenderer content={formattedOutput} />
                    </div>
                  </button>
                ) : (
                  /* Non-MCP or collapsed: render as pre */
                  <button
                    type="button"
                    onClick={() => outTruncated && setOutExpanded(!outExpanded)}
                    className={cn(
                      "w-full text-left",
                      outTruncated && "cursor-pointer group"
                    )}
                    disabled={!outTruncated}
                  >
                    <pre className={cn(
                      'text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed',
                      isError ? 'text-[#ffa198]' : 'text-[#8b8b94]',
                      !outExpanded && outTruncated && 'line-clamp-1'
                    )}>
                      {outExpanded ? (isMcp ? formattedOutput : outputText) : outPreview}
                      {!outExpanded && outTruncated && (
                        <span className="text-[#52525b] group-hover:text-[#8b8b94]"> ...</span>
                      )}
                    </pre>
                  </button>
                )}
              </div>
              {(outTruncated || (isMcp && outExpanded)) && (
                <button
                  type="button"
                  onClick={() => setOutExpanded(!outExpanded)}
                  className="shrink-0"
                >
                  <Icon
                    name={outExpanded ? 'expand_less' : 'expand_more'}
                    className="text-[#52525b] hover:text-[#8b8b94] !text-[14px]"
                  />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ToolUseBlock.displayName = 'ToolUseBlock';

// Memoize to prevent re-renders when props haven't changed
const MemoizedToolUseBlock = React.memo(ToolUseBlock);
MemoizedToolUseBlock.displayName = 'ToolUseBlock';

export { MemoizedToolUseBlock as ToolUseBlock };
