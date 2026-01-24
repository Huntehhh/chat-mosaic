/**
 * VS Code API Mock for Testing
 *
 * Provides mock implementations of VS Code APIs used by the extension.
 * This is a framework-agnostic mock that works with VS Code's test runner.
 */

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
// Types
// =============================================================================

export interface MockWebviewPanel {
  webview: MockWebview;
  onDidDispose: MockFn;
  onDidChangeViewState: MockFn;
  reveal: MockFn;
  dispose: MockFn;
  visible: boolean;
  active: boolean;
  viewColumn?: number;
  title: string;
}

export interface MockWebview {
  html: string;
  postMessage: MockFn;
  onDidReceiveMessage: MockFn;
  asWebviewUri: MockFn;
  cspSource: string;
}

export interface MockTerminal {
  show: MockFn;
  sendText: MockFn;
  dispose: MockFn;
  name: string;
}

export interface MockTextDocument {
  uri: { fsPath: string; scheme: string };
  getText: MockFn;
  lineAt: MockFn;
  lineCount: number;
}

// =============================================================================
// Mock Factories
// =============================================================================

export function createMockWebviewPanel(title = 'Test Panel'): MockWebviewPanel {
  return {
    webview: createMockWebview(),
    onDidDispose: createMockFn(() => ({ dispose: createMockFn() })),
    onDidChangeViewState: createMockFn(() => ({ dispose: createMockFn() })),
    reveal: createMockFn(),
    dispose: createMockFn(),
    visible: true,
    active: true,
    viewColumn: 1,
    title,
  };
}

export function createMockWebview(): MockWebview {
  return {
    html: '',
    postMessage: createMockFn(() => Promise.resolve(true)),
    onDidReceiveMessage: createMockFn(() => ({ dispose: createMockFn() })),
    asWebviewUri: createMockFn((uri: any) => uri),
    cspSource: 'https://mock-csp-source',
  };
}

export function createMockTerminal(name = 'Test Terminal'): MockTerminal {
  return {
    show: createMockFn(),
    sendText: createMockFn(),
    dispose: createMockFn(),
    name,
  };
}

export function createMockTextDocument(fsPath: string): MockTextDocument {
  return {
    uri: { fsPath, scheme: 'file' },
    getText: createMockFn(() => ''),
    lineAt: createMockFn((line: number) => ({ text: '', lineNumber: line })),
    lineCount: 0,
  };
}

// =============================================================================
// Main VS Code Mock Object
// =============================================================================

export const vscode = {
  // Window APIs
  window: {
    createWebviewPanel: createMockFn(
      (_viewType: string, title: string, _showOptions: any, _options: any) => {
        return createMockWebviewPanel(title);
      }
    ),
    registerWebviewViewProvider: createMockFn(() => ({ dispose: createMockFn() })),
    showInformationMessage: createMockFn(() => Promise.resolve(undefined)),
    showWarningMessage: createMockFn(() => Promise.resolve(undefined)),
    showErrorMessage: createMockFn(() => Promise.resolve(undefined)),
    showQuickPick: createMockFn(() => Promise.resolve(undefined)),
    showInputBox: createMockFn(() => Promise.resolve(undefined)),
    showOpenDialog: createMockFn(() => Promise.resolve(undefined)),
    showSaveDialog: createMockFn(() => Promise.resolve(undefined)),
    createTerminal: createMockFn((options?: { name?: string }) => {
      return createMockTerminal(options?.name);
    }),
    createOutputChannel: createMockFn((name: string) => ({
      appendLine: createMockFn(),
      append: createMockFn(),
      clear: createMockFn(),
      show: createMockFn(),
      hide: createMockFn(),
      dispose: createMockFn(),
      name,
    })),
    activeTextEditor: undefined as MockTextDocument | undefined,
    visibleTextEditors: [] as MockTextDocument[],
  },

  // Workspace APIs
  workspace: {
    workspaceFolders: [
      {
        uri: { fsPath: '/test-workspace', scheme: 'file' },
        name: 'test-workspace',
        index: 0,
      },
    ] as { uri: { fsPath: string; scheme: string }; name: string; index: number }[],
    getConfiguration: createMockFn((_section?: string) => ({
      get: createMockFn((_key: string, defaultValue?: any) => defaultValue),
      update: createMockFn(() => Promise.resolve(undefined)),
      has: createMockFn(() => false),
      inspect: createMockFn(),
    })),
    onDidChangeConfiguration: createMockFn(() => ({ dispose: createMockFn() })),
    fs: {
      readFile: createMockFn(() => Promise.resolve(new Uint8Array())),
      writeFile: createMockFn(() => Promise.resolve(undefined)),
      stat: createMockFn(() => Promise.resolve({ type: 1, size: 0 })),
      readDirectory: createMockFn(() => Promise.resolve([])),
      createDirectory: createMockFn(() => Promise.resolve(undefined)),
      delete: createMockFn(() => Promise.resolve(undefined)),
      rename: createMockFn(() => Promise.resolve(undefined)),
      copy: createMockFn(() => Promise.resolve(undefined)),
    },
    openTextDocument: createMockFn(() => Promise.resolve(createMockTextDocument('/test'))),
    registerTextDocumentContentProvider: createMockFn(() => ({ dispose: createMockFn() })),
    applyEdit: createMockFn(() => Promise.resolve(true)),
    findFiles: createMockFn(() => Promise.resolve([])),
    saveAll: createMockFn(() => Promise.resolve(true)),
  },

  // Commands
  commands: {
    registerCommand: createMockFn((_command: string, _callback: (...args: any[]) => any) => {
      return { dispose: createMockFn() };
    }),
    executeCommand: createMockFn(() => Promise.resolve(undefined)),
    getCommands: createMockFn(() => Promise.resolve([])),
  },

  // Uri
  Uri: {
    file: (path: string) => ({
      fsPath: path,
      scheme: 'file',
      path,
      toString: () => `file://${path}`,
    }),
    parse: (value: string) => ({
      fsPath: value,
      scheme: 'file',
      path: value,
      toString: () => value,
    }),
    joinPath: (base: { fsPath: string }, ...pathSegments: string[]) => ({
      fsPath: [base.fsPath, ...pathSegments].join('/'),
      scheme: 'file',
    }),
  },

  // Extension Context
  ExtensionContext: class {
    subscriptions: { dispose: () => void }[] = [];
    workspaceState = {
      get: createMockFn(),
      update: createMockFn(() => Promise.resolve(undefined)),
      keys: createMockFn(() => []),
    };
    globalState = {
      get: createMockFn(),
      update: createMockFn(() => Promise.resolve(undefined)),
      keys: createMockFn(() => []),
      setKeysForSync: createMockFn(),
    };
    extensionPath = '/test-extension';
    extensionUri = { fsPath: '/test-extension', scheme: 'file' };
    storagePath = '/test-storage';
    storageUri = { fsPath: '/test-storage', scheme: 'file' };
    globalStoragePath = '/test-global-storage';
    globalStorageUri = { fsPath: '/test-global-storage', scheme: 'file' };
    logPath = '/test-logs';
    logUri = { fsPath: '/test-logs', scheme: 'file' };
    extensionMode = 1;
    asAbsolutePath = (relativePath: string) => `/test-extension/${relativePath}`;
  },

  // Enums
  ViewColumn: {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3,
  },

  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3,
  },

  FileType: {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64,
  },

  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },

  // EventEmitter (for testing event handlers)
  EventEmitter: class<T> {
    private listeners: ((e: T) => void)[] = [];

    event = (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
    };

    fire = (event: T) => {
      this.listeners.forEach((listener) => listener(event));
    };
  },

  // Range and Position
  Range: class {
    constructor(
      public start: { line: number; character: number },
      public end: { line: number; character: number }
    ) {}
  },

  Position: class {
    constructor(
      public line: number,
      public character: number
    ) {}
  },

  // Clipboard
  env: {
    clipboard: {
      readText: createMockFn(() => Promise.resolve('')),
      writeText: createMockFn(() => Promise.resolve(undefined)),
    },
    openExternal: createMockFn(() => Promise.resolve(true)),
    uriScheme: 'vscode',
    appName: 'Visual Studio Code',
    language: 'en',
    machineId: 'test-machine-id',
  },

  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15,
  },

  Disposable: {
    from: (...disposables: { dispose: () => void }[]) => ({
      dispose: () => disposables.forEach((d) => d.dispose()),
    }),
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Reset all mocks to initial state.
 */
export function resetVSCodeMocks(): void {
  // Reset workspace folders
  vscode.workspace.workspaceFolders = [
    {
      uri: { fsPath: '/test-workspace', scheme: 'file' },
      name: 'test-workspace',
      index: 0,
    },
  ];

  // Reset editor state
  vscode.window.activeTextEditor = undefined;
  vscode.window.visibleTextEditors = [];

  // Clear all mock calls
  vscode.window.createWebviewPanel.mockClear();
  vscode.window.showInformationMessage.mockClear();
  vscode.window.showErrorMessage.mockClear();
  vscode.workspace.fs.readFile.mockClear();
  vscode.workspace.fs.writeFile.mockClear();
  vscode.commands.registerCommand.mockClear();
  vscode.commands.executeCommand.mockClear();
}

/**
 * Set mock workspace folder.
 */
export function setMockWorkspaceFolder(path: string, name?: string): void {
  vscode.workspace.workspaceFolders = [
    {
      uri: { fsPath: path, scheme: 'file' },
      name: name || path.split('/').pop() || 'workspace',
      index: 0,
    },
  ];
}

/**
 * Set mock configuration values.
 */
export function setMockConfiguration(section: string, values: Record<string, any>): void {
  vscode.workspace.getConfiguration.mockImplementation((requestedSection?: string) => ({
    get: createMockFn((key: string, defaultValue?: any) => {
      if (requestedSection === section && key in values) {
        return values[key];
      }
      return defaultValue;
    }),
    update: createMockFn(() => Promise.resolve(undefined)),
    has: createMockFn((key: string) => key in values),
    inspect: createMockFn(),
  }));
}

export default vscode;
