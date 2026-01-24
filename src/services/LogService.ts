/**
 * LogService - Global file logging for the extension
 *
 * Creates a new current.log on each extension restart.
 * Captures all console.log, console.warn, console.error output.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface LogServiceCallbacks {
	getStoragePath: () => string | undefined;
}

let logServiceInstance: LogService | undefined;

export function getLogService(): LogService | undefined {
	return logServiceInstance;
}

export function initializeLogService(callbacks: LogServiceCallbacks): LogService {
	if (logServiceInstance) {
		return logServiceInstance;
	}
	logServiceInstance = new LogService(callbacks);
	return logServiceInstance;
}

export function resetLogService(): void {
	if (logServiceInstance) {
		logServiceInstance.dispose();
		logServiceInstance = undefined;
	}
}

export class LogService {
	private _logPath: string | undefined;
	private _writeStream: fs.WriteStream | undefined;
	private _originalConsole = {
		log: console.log,
		warn: console.warn,
		error: console.error,
		info: console.info,
		debug: console.debug
	};
	private _isInitialized = false;

	constructor(private readonly _callbacks: LogServiceCallbacks) {
		this._initialize();
	}

	private _initialize(): void {
		const storagePath = this._callbacks.getStoragePath();
		if (!storagePath) {
			console.warn('[LogService] No storage path available, logging to file disabled');
			return;
		}

		// Create logs directory if it doesn't exist
		const logsDir = path.join(storagePath, 'logs');
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
		}

		// Create current.log path
		this._logPath = path.join(logsDir, 'current.log');

		// Clear existing log file on restart (create fresh)
		try {
			fs.writeFileSync(this._logPath, `=== Extension Started: ${new Date().toISOString()} ===\n\n`);
		} catch (err) {
			console.error('[LogService] Failed to create log file:', err);
			return;
		}

		// Open write stream for appending
		this._writeStream = fs.createWriteStream(this._logPath, { flags: 'a' });

		// Intercept console methods
		this._interceptConsole();
		this._isInitialized = true;
	}

	private _interceptConsole(): void {
		const self = this;

		console.log = function (...args: any[]) {
			self._originalConsole.log.apply(console, args);
			self._writeToFile('LOG', args);
		};

		console.warn = function (...args: any[]) {
			self._originalConsole.warn.apply(console, args);
			self._writeToFile('WARN', args);
		};

		console.error = function (...args: any[]) {
			self._originalConsole.error.apply(console, args);
			self._writeToFile('ERROR', args);
		};

		console.info = function (...args: any[]) {
			self._originalConsole.info.apply(console, args);
			self._writeToFile('INFO', args);
		};

		console.debug = function (...args: any[]) {
			self._originalConsole.debug.apply(console, args);
			self._writeToFile('DEBUG', args);
		};
	}

	private _writeToFile(level: string, args: any[]): void {
		if (!this._writeStream) return;

		const timestamp = new Date().toISOString();
		const message = args.map(arg => {
			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg, null, 2);
				} catch {
					return String(arg);
				}
			}
			return String(arg);
		}).join(' ');

		const logLine = `[${timestamp}] [${level}] ${message}\n`;

		try {
			this._writeStream.write(logLine);
		} catch (err) {
			// Use original console to avoid infinite loop
			this._originalConsole.error('[LogService] Failed to write to log file:', err);
		}
	}

	/**
	 * Log a message directly (bypasses console interception)
	 */
	public log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
		const timestamp = new Date().toISOString();
		const dataStr = data ? ` ${JSON.stringify(data)}` : '';
		const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`;

		if (this._writeStream) {
			this._writeStream.write(logLine);
		}

		// Also write to original console
		switch (level) {
			case 'warn':
				this._originalConsole.warn(message, data);
				break;
			case 'error':
				this._originalConsole.error(message, data);
				break;
			case 'debug':
				this._originalConsole.debug(message, data);
				break;
			default:
				this._originalConsole.log(message, data);
		}
	}

	/**
	 * Get the current log file path
	 */
	public getLogPath(): string | undefined {
		return this._logPath;
	}

	/**
	 * Flush the log buffer to disk
	 */
	public flush(): void {
		// Node streams auto-flush, but we can force it
		if (this._writeStream) {
			// @ts-ignore - drain event
			this._writeStream.once('drain', () => {});
		}
	}

	/**
	 * Restore original console methods and close stream
	 */
	public dispose(): void {
		// Restore original console methods
		console.log = this._originalConsole.log;
		console.warn = this._originalConsole.warn;
		console.error = this._originalConsole.error;
		console.info = this._originalConsole.info;
		console.debug = this._originalConsole.debug;

		// Close write stream
		if (this._writeStream) {
			this._writeStream.end();
			this._writeStream = undefined;
		}

		this._isInitialized = false;
	}
}
