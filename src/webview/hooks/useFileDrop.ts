import { useCallback, useRef, useState, DragEvent } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Hook for handling file/folder drag-and-drop onto the chat panel.
 * Converts dropped file paths to relative paths with @ prefix.
 *
 * @param onDrop - Callback when files are dropped, receives formatted path string
 * @returns Event handlers and state for drag-drop UI
 */
export function useFileDrop(onDrop: (paths: string) => void) {
  const { workspacePath, isWindows } = useSettingsStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  /**
   * Convert an absolute path to a relative path with @ prefix.
   * Handles both Windows (backslash) and Unix (forward slash) paths.
   */
  const toRelativePath = useCallback((absolutePath: string): string => {
    if (!workspacePath) {
      // No workspace, just return the path as-is with @ prefix
      return `@${absolutePath}`;
    }

    // Normalize separators for comparison
    const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
    const normalizedWorkspace = workspacePath.replace(/\\/g, '/');

    // Check if the file is within the workspace
    if (normalizedAbsolute.toLowerCase().startsWith(normalizedWorkspace.toLowerCase())) {
      // Extract relative path
      let relativePath = normalizedAbsolute.substring(normalizedWorkspace.length);
      // Remove leading slash if present
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
      }
      return `@${relativePath}`;
    }

    // File is outside workspace, use absolute path
    return `@${absolutePath}`;
  }, [workspacePath]);

  /**
   * Parse file URIs from the drag event's dataTransfer.
   * VS Code provides file:// URIs in text/uri-list or application/vnd.code.uri-list format.
   */
  const parseFileUris = useCallback((dataTransfer: DataTransfer): string[] => {
    const paths: string[] = [];

    // Log available types for debugging
    console.log('[useFileDrop] Available data types:', Array.from(dataTransfer.types));

    // Try VS Code specific format first
    let uriList = dataTransfer.getData('application/vnd.code.uri-list');

    // Fallback to standard text/uri-list
    if (!uriList) {
      uriList = dataTransfer.getData('text/uri-list');
    }

    // Also try text/plain as some VS Code versions use this
    if (!uriList) {
      const plainText = dataTransfer.getData('text/plain');
      if (plainText && (plainText.startsWith('file://') || plainText.match(/^[A-Za-z]:\\/))) {
        uriList = plainText;
      }
    }

    if (uriList) {
      console.log('[useFileDrop] URI list found:', uriList);
      const uris = uriList.split('\n').filter(uri => uri.trim() && !uri.startsWith('#'));
      for (const uri of uris) {
        try {
          const trimmedUri = uri.trim();

          // Handle direct Windows paths (C:\path\file.txt)
          if (trimmedUri.match(/^[A-Za-z]:\\/)) {
            paths.push(trimmedUri);
            continue;
          }

          // Parse file:// URI
          const url = new URL(trimmedUri);
          if (url.protocol === 'file:') {
            let filePath = decodeURIComponent(url.pathname);
            // On Windows, remove leading slash from /C:/path
            if (isWindows && filePath.match(/^\/[A-Za-z]:\//)) {
              filePath = filePath.substring(1);
            }
            paths.push(filePath);
          }
        } catch (e) {
          console.warn('[useFileDrop] Failed to parse URI:', uri, e);
        }
      }
    }

    // Fallback: try Files API (may not work in webview)
    if (paths.length === 0 && dataTransfer.files.length > 0) {
      // Files API doesn't give us paths in webview, just log for debugging
      console.log('[useFileDrop] Files detected but no URI list:', dataTransfer.files.length);
      // Try to get path from file objects (won't work in webview but log for debugging)
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        console.log('[useFileDrop] File:', file.name, 'type:', file.type);
      }
    }

    return paths;
  }, [isWindows]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    // Check if this is a file drag
    if (e.dataTransfer?.types.includes('Files') || e.dataTransfer?.types.includes('text/uri-list')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Set dropEffect to indicate we accept the drop
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (!e.dataTransfer) return;

    const filePaths = parseFileUris(e.dataTransfer);
    if (filePaths.length === 0) {
      console.log('[useFileDrop] No file paths extracted from drop');
      return;
    }

    // Convert to relative paths with @ prefix
    const relativePaths = filePaths.map(toRelativePath);

    // Join with space and call the callback
    const formattedPaths = relativePaths.join(' ');
    console.log('[useFileDrop] Dropped files:', formattedPaths);
    onDrop(formattedPaths);
  }, [parseFileUris, toRelativePath, onDrop]);

  return {
    isDragging,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}
