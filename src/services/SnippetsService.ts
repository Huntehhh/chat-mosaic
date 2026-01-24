/**
 * SnippetsService - Custom prompt snippet management
 *
 * Handles CRUD operations for user-defined prompt snippets stored in VS Code globalState.
 * Extracted from extension.ts to improve modularity and testability.
 */

import type * as vscode from 'vscode';

export interface Snippet {
	id: string;
	name: string;
	content: string;
	description?: string;
	category?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface SnippetsServiceCallbacks {
	postMessage: (message: { type: string; data: unknown }) => void;
}

export class SnippetsService {
	private readonly _storageKey = 'customPromptSnippets';

	constructor(
		private readonly _context: vscode.ExtensionContext,
		private readonly _callbacks: SnippetsServiceCallbacks
	) {}

	/**
	 * Get all snippets from storage
	 */
	async getAll(): Promise<Record<string, Snippet>> {
		return this._context.globalState.get<Record<string, Snippet>>(this._storageKey, {});
	}

	/**
	 * Get a single snippet by ID
	 */
	async get(snippetId: string): Promise<Snippet | undefined> {
		const snippets = await this.getAll();
		return snippets[snippetId];
	}

	/**
	 * Send all snippets to the webview
	 */
	async sendAll(): Promise<void> {
		try {
			const snippets = await this.getAll();
			this._callbacks.postMessage({
				type: 'customSnippetsData',
				data: snippets
			});
		} catch (error) {
			console.error('Error loading custom snippets:', error);
			this._callbacks.postMessage({
				type: 'customSnippetsData',
				data: {}
			});
		}
	}

	/**
	 * Save a snippet (create or update)
	 */
	async save(snippet: Snippet): Promise<boolean> {
		try {
			const snippets = await this.getAll();

			// Add timestamp metadata
			const now = new Date().toISOString();
			const existingSnippet = snippets[snippet.id];
			const updatedSnippet: Snippet = {
				...snippet,
				createdAt: existingSnippet?.createdAt || now,
				updatedAt: now
			};

			snippets[snippet.id] = updatedSnippet;
			await this._context.globalState.update(this._storageKey, snippets);

			this._callbacks.postMessage({
				type: 'customSnippetSaved',
				data: { snippet: updatedSnippet }
			});

			console.log('Saved custom snippet:', snippet.name);
			return true;
		} catch (error) {
			console.error('Error saving custom snippet:', error);
			this._callbacks.postMessage({
				type: 'error',
				data: 'Failed to save custom snippet'
			});
			return false;
		}
	}

	/**
	 * Delete a snippet by ID
	 */
	async delete(snippetId: string): Promise<boolean> {
		try {
			const snippets = await this.getAll();

			if (!snippets[snippetId]) {
				this._callbacks.postMessage({
					type: 'error',
					data: 'Snippet not found'
				});
				return false;
			}

			delete snippets[snippetId];
			await this._context.globalState.update(this._storageKey, snippets);

			this._callbacks.postMessage({
				type: 'customSnippetDeleted',
				data: { snippetId }
			});

			console.log('Deleted custom snippet:', snippetId);
			return true;
		} catch (error) {
			console.error('Error deleting custom snippet:', error);
			this._callbacks.postMessage({
				type: 'error',
				data: 'Failed to delete custom snippet'
			});
			return false;
		}
	}

	/**
	 * Import snippets (merge with existing)
	 */
	async import(snippetsToImport: Record<string, Snippet>): Promise<number> {
		try {
			const snippets = await this.getAll();
			let imported = 0;
			const now = new Date().toISOString();

			for (const [id, snippet] of Object.entries(snippetsToImport)) {
				if (!snippets[id]) {
					snippets[id] = {
						...snippet,
						createdAt: now,
						updatedAt: now
					};
					imported++;
				}
			}

			await this._context.globalState.update(this._storageKey, snippets);
			console.log(`Imported ${imported} snippets`);
			return imported;
		} catch (error) {
			console.error('Error importing snippets:', error);
			return 0;
		}
	}

	/**
	 * Export all snippets (for backup/sharing)
	 */
	async export(): Promise<Record<string, Snippet>> {
		return this.getAll();
	}

	/**
	 * Clear all snippets
	 */
	async clear(): Promise<boolean> {
		try {
			await this._context.globalState.update(this._storageKey, {});
			console.log('Cleared all custom snippets');
			return true;
		} catch (error) {
			console.error('Error clearing snippets:', error);
			return false;
		}
	}
}
