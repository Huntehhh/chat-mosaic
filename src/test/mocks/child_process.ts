/**
 * Child Process Mock for Testing
 *
 * Provides mock implementations of Node.js child_process module.
 * Used for testing ProcessManager and ProcessRegistry without spawning real processes.
 */

import { EventEmitter } from 'events';

/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
// Mock Function Factory (Framework Agnostic)
// =============================================================================

interface MockFn {
  (...args: any[]): any;
  calls: any[][];
  mockReturnValue: (value: any) => MockFn;
  mockResolvedValue: (value: any) => MockFn;
  mockImplementation: (fn: (...args: any[]) => any) => MockFn;
  mockClear: () => void;
}

function createMockFn(implementation?: (...args: any[]) => any): MockFn {
  const calls: any[][] = [];
  let returnValue: any;
  let resolvedValue: any;
  let impl = implementation;

  const mockFn = ((...args: any[]) => {
    calls.push(args);
    if (impl) {
      return impl(...args);
    }
    if (resolvedValue !== undefined) {
      return Promise.resolve(resolvedValue);
    }
    return returnValue;
  }) as MockFn;

  mockFn.calls = calls;
  mockFn.mockReturnValue = (value: any) => {
    returnValue = value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value: any) => {
    resolvedValue = value;
    return mockFn;
  };
  mockFn.mockImplementation = (fn: (...args: any[]) => any) => {
    impl = fn;
    return mockFn;
  };
  mockFn.mockClear = () => {
    calls.length = 0;
  };

  return mockFn;
}

// =============================================================================
// Mock Writable Stream
// =============================================================================

export class MockWritable extends EventEmitter {
  private _buffer: string[] = [];

  write(chunk: string | Buffer): boolean {
    this._buffer.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  }

  end(): void {
    this.emit('finish');
  }

  getWrittenData(): string {
    return this._buffer.join('');
  }

  clear(): void {
    this._buffer = [];
  }
}

// =============================================================================
// Mock Readable Stream
// =============================================================================

export class MockReadable extends EventEmitter {
  private _paused = false;

  pause(): this {
    this._paused = true;
    return this;
  }

  resume(): this {
    this._paused = false;
    return this;
  }

  isPaused(): boolean {
    return this._paused;
  }

  // Helper to emit data for testing
  emitData(data: string | Buffer): void {
    this.emit('data', typeof data === 'string' ? Buffer.from(data) : data);
  }

  emitEnd(): void {
    this.emit('end');
  }

  emitError(error: Error): void {
    this.emit('error', error);
  }
}

// =============================================================================
// Mock Child Process
// =============================================================================

export class MockChildProcess extends EventEmitter {
  pid: number = Math.floor(Math.random() * 100000) + 1000;
  killed: boolean = false;
  exitCode: number | null = null;
  signalCode: string | null = null;
  connected: boolean = true;

  stdin: MockWritable;
  stdout: MockReadable;
  stderr: MockReadable;

  private _killBehavior: 'immediate' | 'delayed' | 'ignore' = 'immediate';
  private _killDelay: number = 0;

  constructor() {
    super();
    this.stdin = new MockWritable();
    this.stdout = new MockReadable();
    this.stderr = new MockReadable();
  }

  kill(signal?: NodeJS.Signals | number): boolean {
    if (this.killed) {
      return false;
    }

    if (this._killBehavior === 'ignore') {
      return false;
    }

    const executeKill = () => {
      this.killed = true;
      this.connected = false;
      this.exitCode = signal === 'SIGKILL' ? 137 : 0;
      this.signalCode = typeof signal === 'string' ? signal : 'SIGTERM';
      this.emit('exit', this.exitCode, this.signalCode);
      this.emit('close', this.exitCode, this.signalCode);
    };

    if (this._killBehavior === 'delayed') {
      setTimeout(executeKill, this._killDelay);
    } else {
      executeKill();
    }

    return true;
  }

  // Test helpers
  setKillBehavior(behavior: 'immediate' | 'delayed' | 'ignore', delay?: number): void {
    this._killBehavior = behavior;
    if (delay !== undefined) {
      this._killDelay = delay;
    }
  }

  simulateExit(code: number, signal?: string): void {
    this.killed = true;
    this.connected = false;
    this.exitCode = code;
    this.signalCode = signal || null;
    this.emit('exit', code, signal);
    this.emit('close', code, signal);
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateSpawn(): void {
    this.emit('spawn');
  }
}

// =============================================================================
// Spawn Records for Assertions
// =============================================================================

export interface SpawnCall {
  command: string;
  args: string[];
  options: any;
  process: MockChildProcess;
}

const spawnCalls: SpawnCall[] = [];
let nextSpawnProcess: MockChildProcess | undefined;
let spawnShouldFail: Error | undefined;

// =============================================================================
// Mock spawn Function
// =============================================================================

export function spawn(command: string, args?: readonly string[], options?: any): MockChildProcess {
  if (spawnShouldFail) {
    const error = spawnShouldFail;
    spawnShouldFail = undefined;
    throw error;
  }

  const process = nextSpawnProcess || new MockChildProcess();
  nextSpawnProcess = undefined;

  spawnCalls.push({
    command,
    args: args ? [...args] : [],
    options: options || {},
    process
  });

  // Emit spawn event on next tick to simulate async nature
  setImmediate(() => {
    process.simulateSpawn();
  });

  return process;
}

// =============================================================================
// Mock exec Function (Promisified)
// =============================================================================

export interface ExecResult {
  stdout: string;
  stderr: string;
}

const execCalls: { command: string; options: any }[] = [];
let nextExecResult: ExecResult = { stdout: '', stderr: '' };
let execShouldFail: Error | undefined;

export async function exec(command: string, options?: any): Promise<ExecResult> {
  execCalls.push({ command, options });

  if (execShouldFail) {
    const error = execShouldFail;
    execShouldFail = undefined;
    throw error;
  }

  return nextExecResult;
}

// =============================================================================
// Mock Control Functions
// =============================================================================

export function resetMock(): void {
  spawnCalls.length = 0;
  execCalls.length = 0;
  nextSpawnProcess = undefined;
  spawnShouldFail = undefined;
  nextExecResult = { stdout: '', stderr: '' };
  execShouldFail = undefined;
}

export function setNextSpawnProcess(process: MockChildProcess): void {
  nextSpawnProcess = process;
}

export function setSpawnShouldFail(error: Error): void {
  spawnShouldFail = error;
}

export function setNextExecResult(result: ExecResult): void {
  nextExecResult = result;
}

export function setExecShouldFail(error: Error): void {
  execShouldFail = error;
}

export function getSpawnCalls(): SpawnCall[] {
  return [...spawnCalls];
}

export function getExecCalls(): { command: string; options: any }[] {
  return [...execCalls];
}

export function getLastSpawnCall(): SpawnCall | undefined {
  return spawnCalls[spawnCalls.length - 1];
}

export function getLastExecCall(): { command: string; options: any } | undefined {
  return execCalls[execCalls.length - 1];
}

// =============================================================================
// Helper: Create Pre-configured Mock Process
// =============================================================================

export function createMockProcess(options?: {
  pid?: number;
  exitCode?: number;
  signalCode?: string;
  killBehavior?: 'immediate' | 'delayed' | 'ignore';
  killDelay?: number;
}): MockChildProcess {
  const process = new MockChildProcess();

  if (options?.pid) {
    process.pid = options.pid;
  }
  if (options?.killBehavior) {
    process.setKillBehavior(options.killBehavior, options.killDelay);
  }

  return process;
}

export { createMockFn };
