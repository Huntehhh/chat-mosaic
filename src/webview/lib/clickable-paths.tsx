import React, { createContext, useContext } from 'react';

/**
 * Context for file opening function
 * This allows ClickablePath components to open files without prop drilling
 */
const OpenFileContext = createContext<((path: string) => void) | null>(null);

export function OpenFileProvider({
  children,
  onOpenFile
}: {
  children: React.ReactNode;
  onOpenFile: (path: string) => void;
}) {
  return (
    <OpenFileContext.Provider value={onOpenFile}>
      {children}
    </OpenFileContext.Provider>
  );
}

function useOpenFile() {
  return useContext(OpenFileContext);
}

/**
 * Regex patterns for detecting file paths
 */
// Absolute paths: c:/path/file.ext, /path/file.ext, C:\path\file.ext
// Note: No spaces allowed in paths
const ABSOLUTE_PATH_REGEX = /(?:(?:[a-zA-Z]:)?[\\\/])?(?:[\w\-.]+[\\\/])*[\w\-.]+\.[a-zA-Z0-9]+/g;

// File with extension pattern (for relative files)
const FILE_WITH_EXT_REGEX = /[\w\-]+(?:\.[\w\-]+)*\.[a-zA-Z0-9]{1,10}/g;

/**
 * Check if a string looks like a file path
 */
function isFilePath(str: string): boolean {
  // Must have a file extension
  if (!/\.[a-zA-Z0-9]{1,10}$/.test(str)) return false;

  // Skip URLs
  if (str.startsWith('http://') || str.startsWith('https://')) return false;

  // Skip common non-file patterns
  if (str.match(/^(v?\d+\.\d+\.\d+|npm@|node@)/)) return false;

  return true;
}

/**
 * Check if path is likely absolute
 */
function isAbsolutePath(path: string): boolean {
  // Windows: C:/ or C:\
  if (/^[a-zA-Z]:[\\\/]/.test(path)) return true;
  // Unix: starts with /
  if (path.startsWith('/') && !path.startsWith('//')) return true;
  return false;
}

interface ClickablePathProps {
  path: string;
  className?: string;
}

interface ClickableURLProps {
  url: string;
  className?: string;
}

/**
 * Renders a clickable URL that opens in the default browser
 */
export function ClickableURL({ url, className = '' }: ClickableURLProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      href={url}
      className={`clickable-url cursor-pointer text-[#FFA344] hover:underline hover:text-[#FFB86C] transition-colors ${className}`}
      onClick={handleClick}
      title={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {url}
    </a>
  );
}

/**
 * Renders a clickable file path that opens in VS Code
 */
export function ClickablePath({ path, className = '' }: ClickablePathProps) {
  const openFile = useOpenFile();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (openFile) {
      openFile(path);
    }
  };

  // If no openFile context, render as plain text
  if (!openFile) {
    return <span className={className}>{path}</span>;
  }

  return (
    <span
      className={`clickable-path cursor-pointer text-[#FFA344] hover:underline hover:text-[#FFB86C] transition-colors ${className}`}
      onClick={handleClick}
      title={`Open ${path}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick(e as any)}
    >
      {path}
    </span>
  );
}

interface ClickableTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with file paths made clickable
 * Detects both absolute paths (c:/path/file.ext) and relative files (file.ext)
 */
export function ClickableText({ text, className = '' }: ClickableTextProps) {
  // Find all potential file paths
  const parts: Array<{ type: 'text' | 'path'; content: string }> = [];
  let lastIndex = 0;

  // Combined regex to find both absolute and relative paths
  // Matches: c:/path/file.ext, /path/file.ext, path/file.ext, file.ext
  // IMPORTANT: No spaces allowed in paths - use [\w\-.] not [\w\-. ]
  const pathRegex = /(?:(?:[a-zA-Z]:)?[\\\/])?(?:[\w\-.]+[\\\/])*[\w\-.]+\.[a-zA-Z0-9]{1,10}(?=[\s,;:)\]}"']|$)/g;

  let match;
  while ((match = pathRegex.exec(text)) !== null) {
    const path = match[0];

    // Validate it looks like a file path
    if (!isFilePath(path)) continue;

    // Skip very short matches that are probably not files
    if (path.length < 3) continue;

    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    // Add the path
    parts.push({ type: 'path', content: path });
    lastIndex = match.index + path.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // If no paths found, return plain text
  if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'path' ? (
          <ClickablePath key={i} path={part.content} />
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </span>
  );
}

export default ClickableText;
