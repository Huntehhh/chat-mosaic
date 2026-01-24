/**
 * WorkspaceFileService - Handles workspace file operations
 *
 * Centralizes file reading, directory listing, and workspace path resolution
 * for consistent behavior across the extension.
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

export interface FileStat {
  size: number;
  mtime: number;
  isDirectory: boolean;
}

export class WorkspaceFileService {
  /**
   * Get the current workspace folder path
   */
  getWorkspacePath(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Read a file's contents as Uint8Array
   */
  async readFile(filePath: string): Promise<Uint8Array> {
    const fileUri = vscode.Uri.file(filePath);
    return vscode.workspace.fs.readFile(fileUri);
  }

  /**
   * Read a file's contents as string
   */
  async readFileAsString(filePath: string): Promise<string> {
    const data = await this.readFile(filePath);
    return new TextDecoder().decode(data);
  }

  /**
   * Write content to a file
   */
  async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
    const fileUri = vscode.Uri.file(filePath);
    const data = typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content;
    await vscode.workspace.fs.writeFile(fileUri, data);
  }

  /**
   * Read directory contents
   */
  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    const dirUri = vscode.Uri.file(dirPath);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    return entries.map(([name, type]) => ({
      name,
      type: type === vscode.FileType.File ? 'file' : 'directory',
      path: path.join(dirPath, name)
    }));
  }

  /**
   * Get file/directory stats
   */
  async stat(filePath: string): Promise<FileStat> {
    const fileUri = vscode.Uri.file(filePath);
    const stats = await vscode.workspace.fs.stat(fileUri);
    return {
      size: stats.size,
      mtime: stats.mtime,
      isDirectory: stats.type === vscode.FileType.Directory
    };
  }

  /**
   * Check if a file/directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await this.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a directory (and parents if needed)
   */
  async createDirectory(dirPath: string): Promise<void> {
    const dirUri = vscode.Uri.file(dirPath);
    await vscode.workspace.fs.createDirectory(dirUri);
  }

  /**
   * Delete a file or directory
   */
  async delete(filePath: string, options?: { recursive?: boolean }): Promise<void> {
    const fileUri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.delete(fileUri, options);
  }

  /**
   * Search for files matching a pattern in the workspace
   */
  async findFiles(pattern: string, exclude?: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(pattern, exclude);
    return files.map(uri => uri.fsPath);
  }

  /**
   * Get workspace files for file picker UI
   */
  async getWorkspaceFiles(searchTerm?: string): Promise<FileEntry[]> {
    const workspacePath = this.getWorkspacePath();
    if (!workspacePath) return [];

    try {
      const pattern = searchTerm ? `**/*${searchTerm}*` : '**/*';
      const files = await this.findFiles(pattern, '**/node_modules/**');

      return files.slice(0, 100).map(filePath => ({
        name: path.basename(filePath),
        type: 'file' as const,
        path: filePath
      }));
    } catch (error) {
      console.error('Error getting workspace files:', error);
      return [];
    }
  }
}

// Singleton instance
let _workspaceFileService: WorkspaceFileService | undefined;

export function getWorkspaceFileService(): WorkspaceFileService {
  if (!_workspaceFileService) {
    _workspaceFileService = new WorkspaceFileService();
  }
  return _workspaceFileService;
}

export function resetWorkspaceFileService(): void {
  _workspaceFileService = undefined;
}
