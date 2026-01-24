/**
 * DiffService - Diff editor and content provider management
 *
 * Handles VS Code diff editor functionality with LRU cache for memory efficiency.
 * Extracted from extension.ts to improve modularity and add memory management.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * LRU Cache implementation for diff content storage
 * Prevents unbounded memory growth from accumulated diff content
 */
export class LRUCache<K, V> {
	private cache = new Map<K, V>();
	private readonly maxSize: number;

	constructor(maxSize: number = 50) {
		this.maxSize = maxSize;
	}

	get(key: K): V | undefined {
		if (!this.cache.has(key)) {
			return undefined;
		}
		// Move to end (most recently used)
		const value = this.cache.get(key)!;
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	set(key: K, value: V): void {
		// Delete existing to refresh position
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}
		// Evict oldest entries if at capacity
		while (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				this.cache.delete(firstKey);
			}
		}
		this.cache.set(key, value);
	}

	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	get size(): number {
		return this.cache.size;
	}

	clear(): void {
		this.cache.clear();
	}
}

/**
 * VS Code TextDocumentContentProvider for read-only diff views
 */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
	constructor(private readonly _contentStore: LRUCache<string, string>) {}

	provideTextDocumentContent(uri: vscode.Uri): string {
		const content = this._contentStore.get(uri.path);
		return content || '';
	}
}

export interface ConversationMessage {
	data: {
		toolName?: string;
		rawInput?: {
			file_path?: string;
			old_string?: string;
			new_string?: string;
			content?: string;
			edits?: Array<{ old_string?: string; new_string?: string }>;
		};
	};
}

export interface DiffServiceCallbacks {
	getConversationMessage: (index: number) => ConversationMessage | undefined;
	addDisposable: (disposable: vscode.Disposable) => void;
}

export interface DiffServiceConfig {
	/** Maximum number of diff content entries to cache (default: 100) */
	maxCacheSize?: number;
}

export class DiffService {
	private readonly _contentStore: LRUCache<string, string>;
	private readonly _contentProvider: DiffContentProvider;
	private readonly _callbacks: DiffServiceCallbacks;
	private _disposed = false;

	constructor(
		callbacks: DiffServiceCallbacks,
		config: DiffServiceConfig = {}
	) {
		this._callbacks = callbacks;
		this._contentStore = new LRUCache<string, string>(config.maxCacheSize ?? 100);
		this._contentProvider = new DiffContentProvider(this._contentStore);
	}

	/**
	 * Get the content provider to register with VS Code
	 */
	getContentProvider(): vscode.TextDocumentContentProvider {
		return this._contentProvider;
	}

	/**
	 * Open diff view for a conversation message by index
	 */
	async openDiffByMessageIndex(messageIndex: number): Promise<void> {
		if (this._disposed) {
			console.warn('DiffService is disposed');
			return;
		}

		try {
			const message = this._callbacks.getConversationMessage(messageIndex);
			if (!message) {
				console.error('Message not found at index:', messageIndex);
				return;
			}

			const data = message.data;
			const toolName = data.toolName;
			const rawInput = data.rawInput;
			const filePath = rawInput?.file_path || '';

			if (!filePath) {
				console.error('No file path found for message at index:', messageIndex);
				return;
			}

			let oldContent = '';
			let newContent = '';

			// Read current file from disk - this is the "before" state since edit hasn't been applied yet
			try {
				const fileUri = vscode.Uri.file(filePath);
				const fileData = await vscode.workspace.fs.readFile(fileUri);
				oldContent = Buffer.from(fileData).toString('utf8');
			} catch {
				// File might not exist yet (for Write creating new file)
				oldContent = '';
			}

			// Compute "after" state by applying the edit to current file
			if (toolName === 'Edit' && rawInput?.old_string && rawInput?.new_string) {
				newContent = oldContent.replace(rawInput.old_string, rawInput.new_string);
			} else if (toolName === 'MultiEdit' && rawInput?.edits) {
				newContent = oldContent;
				for (const edit of rawInput.edits) {
					if (edit.old_string && edit.new_string) {
						newContent = newContent.replace(edit.old_string, edit.new_string);
					}
				}
			} else if (toolName === 'Write' && rawInput?.content) {
				newContent = rawInput.content;
			}

			if (oldContent !== newContent) {
				await this.openDiffEditor(oldContent, newContent, filePath);
			} else {
				vscode.window.showInformationMessage('No changes to show - the edit may have already been applied.');
			}
		} catch (error) {
			console.error('Error opening diff by message index:', error);
		}
	}

	/**
	 * Open diff editor with provided content
	 */
	async openDiffEditor(oldContent: string, newContent: string, filePath: string): Promise<void> {
		if (this._disposed) {
			console.warn('DiffService is disposed');
			return;
		}

		try {
			const baseName = path.basename(filePath);
			const timestamp = Date.now();

			// Create unique paths for the virtual documents
			const oldPath = `/${timestamp}/old/${baseName}`;
			const newPath = `/${timestamp}/new/${baseName}`;

			// Store content in the LRU cache
			this._contentStore.set(oldPath, oldContent);
			this._contentStore.set(newPath, newContent);

			// Create URIs with our custom scheme
			const oldUri = vscode.Uri.parse(`claude-diff:${oldPath}`);
			const newUri = vscode.Uri.parse(`claude-diff:${newPath}`);

			// Ensure side-by-side diff mode is enabled
			const diffConfig = vscode.workspace.getConfiguration('diffEditor');
			const wasInlineMode = diffConfig.get('renderSideBySide') === false;
			if (wasInlineMode) {
				await diffConfig.update('renderSideBySide', true, vscode.ConfigurationTarget.Global);
			}

			// Open diff editor
			await vscode.commands.executeCommand('vscode.diff', oldUri, newUri, `${baseName} (Changes)`);

			// Clean up stored content when documents are closed
			const closeListener = vscode.workspace.onDidCloseTextDocument((doc) => {
				if (doc.uri.toString() === oldUri.toString()) {
					this._contentStore.delete(oldPath);
				}
				if (doc.uri.toString() === newUri.toString()) {
					this._contentStore.delete(newPath);
				}
				// Dispose listener when both are cleaned up
				if (!this._contentStore.has(oldPath) && !this._contentStore.has(newPath)) {
					closeListener.dispose();
				}
			});

			this._callbacks.addDisposable(closeListener);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open diff editor: ${error}`);
			console.error('Error opening diff editor:', error);
		}
	}

	/**
	 * Get current cache size for monitoring
	 */
	getCacheSize(): number {
		return this._contentStore.size;
	}

	/**
	 * Clear all cached content
	 */
	clearCache(): void {
		this._contentStore.clear();
	}

	/**
	 * Dispose the service and clear resources
	 */
	dispose(): void {
		this._disposed = true;
		this._contentStore.clear();
	}
}

// Singleton for global access if needed
let diffServiceInstance: DiffService | null = null;

export function getDiffService(): DiffService | null {
	return diffServiceInstance;
}

export function setDiffService(service: DiffService): void {
	diffServiceInstance = service;
}

export function resetDiffService(): void {
	if (diffServiceInstance) {
		diffServiceInstance.dispose();
		diffServiceInstance = null;
	}
}
