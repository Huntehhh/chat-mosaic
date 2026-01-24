/**
 * StreamProcessor - Handles JSON stream parsing from Claude stdout
 *
 * Processes the JSONL output from Claude CLI and dispatches to appropriate handlers.
 * Decoupled from ClaudeChatProvider via callbacks.
 */

import * as vscode from 'vscode';

// =============================================================================
// Types
// =============================================================================

/**
 * State that StreamProcessor needs to read/update
 */
export interface StreamState {
  currentSessionId: string | undefined;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  requestCount: number;
  currentTodos: Array<{ content: string; status: string; activeForm?: string }>;
  isProcessing: boolean;
}

/**
 * Callbacks for StreamProcessor to communicate with ClaudeChatProvider
 */
export interface StreamProcessorCallbacks {
  /** Post a message to the webview (UI-only, not saved) */
  postMessage: (message: { type: string; data?: any }, panelId?: string) => void;

  /** Send and save a message to conversation */
  sendAndSaveMessage: (message: { type: string; data: any }, panelId?: string) => void;

  /** Handle login required */
  handleLoginRequired: () => void;

  /** Get conversation for a panel (or current) */
  getConversation: (panelId?: string) => Array<{ timestamp: string; messageType: string; data: any }>;

  /** Get current state */
  getState: () => StreamState;

  /** Update state values */
  updateState: (updates: Partial<StreamState>) => void;

  /** Read file content for diff display */
  readFile: (filePath: string) => Promise<string | undefined>;

  /** Called when Claude finishes responding (result message received) */
  onResponseComplete?: (panelId?: string) => void;
}

/**
 * Result from processing stdout data
 */
export interface StdoutProcessResult {
  /** Lines that were successfully parsed */
  parsedLines: number;
  /** Control requests that need handling */
  controlRequests: any[];
  /** Control responses received */
  controlResponses: any[];
}

// =============================================================================
// StreamProcessor Class
// =============================================================================

export class StreamProcessor {
  private _callbacks: StreamProcessorCallbacks;
  private _rawOutputBuffer: string = '';
  private _errorOutputBuffer: string = '';

  /**
   * Generation counter to prevent stale messages from old sessions
   * bleeding into new sessions. Incremented on session change.
   */
  private _generation: number = 0;

  constructor(callbacks: StreamProcessorCallbacks) {
    this._callbacks = callbacks;
  }

  /**
   * Increment the generation counter.
   * Call this when starting a new session or loading a conversation.
   * All messages from the previous generation will be ignored.
   */
  newGeneration(): number {
    console.log(`[StreamProcessor] New generation: ${++this._generation}`);
    return this._generation;
  }

  /**
   * Get current generation number
   */
  getGeneration(): number {
    return this._generation;
  }

  /**
   * Check if a generation is still valid (current)
   */
  isGenerationValid(generation: number): boolean {
    return generation === this._generation;
  }

  /**
   * Reset output buffers (call after process close)
   */
  resetBuffers(): void {
    this._rawOutputBuffer = '';
    this._errorOutputBuffer = '';
  }

  /**
   * Get accumulated error output
   */
  getErrorOutput(): string {
    return this._errorOutputBuffer;
  }

  // ===========================================================================
  // Stdout Processing
  // ===========================================================================

  /**
   * Process stdout data from Claude process.
   * Buffers incomplete lines and parses JSON messages.
   *
   * @param data - Raw stdout data
   * @param generation - Optional generation number to validate against.
   *                    If provided, messages will be ignored if generation doesn't match.
   * @returns Control requests that need external handling
   */
  processStdout(data: string, generation?: number): { controlRequests: any[]; controlResponses: any[] } {
    // If generation is provided and doesn't match, ignore this data
    // This prevents stale messages from old sessions bleeding into new ones
    if (generation !== undefined && !this.isGenerationValid(generation)) {
      console.log(`[StreamProcessor] Ignoring stale data from generation ${generation} (current: ${this._generation})`);
      return { controlRequests: [], controlResponses: [] };
    }

    this._rawOutputBuffer += data;
    const lines = this._rawOutputBuffer.split('\n');
    this._rawOutputBuffer = lines.pop() || '';

    const controlRequests: any[] = [];
    const controlResponses: any[] = [];

    for (const line of lines) {
      if (line.trim()) {
        try {
          const jsonData = JSON.parse(line.trim());

          if (jsonData.type === 'control_request') {
            controlRequests.push(jsonData);
            continue;
          }

          if (jsonData.type === 'control_response') {
            controlResponses.push(jsonData);
            continue;
          }

          // Process regular JSON stream data
          this._processJsonStreamData(jsonData);
        } catch (error) {
          console.log('Failed to parse JSON line:', line, error);
        }
      }
    }

    return { controlRequests, controlResponses };
  }

  // ===========================================================================
  // Stderr Processing
  // ===========================================================================

  /**
   * Process stderr data from Claude process.
   * Accumulates error output for reporting on close.
   */
  processStderr(data: string): void {
    this._errorOutputBuffer += data;
  }

  // ===========================================================================
  // Close Handling
  // ===========================================================================

  /**
   * Handle process close event.
   * Reports errors if any and clears buffers.
   *
   * @param code - Exit code
   * @param intentionalKill - Whether this was an intentional kill (suppress errors)
   */
  handleClose(code: number | null, intentionalKill: boolean): void {
    console.log('Claude process closed with code:', code);

    if (intentionalKill) {
      console.log('Suppressing close error during intentional kill');
      this.resetBuffers();
      return;
    }

    this._callbacks.postMessage({ type: 'clearLoading' });
    this._callbacks.updateState({ isProcessing: false });
    this._callbacks.postMessage({ type: 'setProcessing', data: { isProcessing: false } });

    if (code !== 0 && this._errorOutputBuffer.trim()) {
      this._callbacks.postMessage({ type: 'error', data: this._errorOutputBuffer.trim() });
    }

    this.resetBuffers();
  }

  /**
   * Handle process error event.
   * Shows install modal for missing CLI or reports error.
   */
  handleError(error: Error, intentionalKill: boolean): void {
    console.log('Claude process error:', error.message);

    if (intentionalKill) {
      console.log('Suppressing error during intentional kill');
      return;
    }

    this._callbacks.postMessage({ type: 'clearLoading' });
    this._callbacks.updateState({ isProcessing: false });
    this._callbacks.postMessage({ type: 'setProcessing', data: { isProcessing: false } });

    if (error.message.includes('ENOENT') || error.message.includes('command not found')) {
      this._callbacks.postMessage({ type: 'showInstallModal' });
    } else {
      this._callbacks.postMessage({ type: 'error', data: `Error running Claude: ${error.message}` });
    }

    this.resetBuffers();
  }

  // ===========================================================================
  // JSON Stream Data Processing
  // ===========================================================================

  /**
   * Process a single JSON message directly (for panel process path).
   * This is the public entry point for processing JSON that doesn't come
   * through the stdout buffer.
   */
  async processJson(jsonData: any, panelId?: string): Promise<void> {
    return this._processJsonStreamData(jsonData, panelId);
  }

  /**
   * Process a single JSON message from the stream
   */
  private async _processJsonStreamData(jsonData: any, panelId?: string): Promise<void> {
    const postMsg = (message: any) => this._callbacks.postMessage(message, panelId);
    const sendAndSave = (message: { type: string; data: any }) =>
      this._callbacks.sendAndSaveMessage(message, panelId);
    const state = this._callbacks.getState();

    switch (jsonData.type) {
      case 'system':
        this._handleSystemMessage(jsonData, postMsg, state);
        break;

      case 'assistant':
        await this._handleAssistantMessage(jsonData, postMsg, sendAndSave, state);
        break;

      case 'user':
        await this._handleUserMessage(jsonData, postMsg, sendAndSave, panelId);
        break;

      case 'result':
        this._handleResultMessage(jsonData, postMsg, state, panelId);
        break;
    }
  }

  // ===========================================================================
  // Message Type Handlers
  // ===========================================================================

  private _handleSystemMessage(
    jsonData: any,
    postMsg: (msg: any) => void,
    state: StreamState
  ): void {
    if (jsonData.subtype === 'init') {
      console.log('System initialized');
      this._callbacks.updateState({ currentSessionId: jsonData.session_id });

      postMsg({
        type: 'sessionInfo',
        data: {
          sessionId: jsonData.session_id,
          tools: jsonData.tools || [],
          mcpServers: jsonData.mcp_servers || []
        }
      });
    } else if (jsonData.subtype === 'status') {
      if (jsonData.status === 'compacting') {
        console.log('Conversation compacting started');
        postMsg({ type: 'compacting', data: { isCompacting: true } });
      } else if (jsonData.status === null) {
        console.log('Status cleared');
        postMsg({ type: 'compacting', data: { isCompacting: false } });
      }
    } else if (jsonData.subtype === 'compact_boundary') {
      console.log('Compact boundary received', jsonData.compact_metadata);
      this._callbacks.updateState({ totalTokensInput: 0, totalTokensOutput: 0 });

      postMsg({
        type: 'compactBoundary',
        data: {
          trigger: jsonData.compact_metadata?.trigger,
          preTokens: jsonData.compact_metadata?.pre_tokens
        }
      });
    }
  }

  private async _handleAssistantMessage(
    jsonData: any,
    postMsg: (msg: any) => void,
    sendAndSave: (msg: { type: string; data: any }) => void,
    state: StreamState
  ): Promise<void> {
    if (!jsonData.message?.content) return;

    // Track token usage
    if (jsonData.message.usage) {
      const newInputTokens = state.totalTokensInput + (jsonData.message.usage.input_tokens || 0);
      const newOutputTokens = state.totalTokensOutput + (jsonData.message.usage.output_tokens || 0);

      this._callbacks.updateState({
        totalTokensInput: newInputTokens,
        totalTokensOutput: newOutputTokens
      });

      postMsg({
        type: 'updateTokens',
        data: {
          totalTokensInput: newInputTokens,
          totalTokensOutput: newOutputTokens,
          currentInputTokens: jsonData.message.usage.input_tokens || 0,
          currentOutputTokens: jsonData.message.usage.output_tokens || 0,
          cacheCreationTokens: jsonData.message.usage.cache_creation_input_tokens || 0,
          cacheReadTokens: jsonData.message.usage.cache_read_input_tokens || 0
        }
      });
    }

    // Process each content item
    for (const content of jsonData.message.content) {
      if (content.type === 'text' && content.text.trim()) {
        sendAndSave({ type: 'output', data: content.text.trim() });
      } else if (content.type === 'thinking' && content.thinking.trim()) {
        sendAndSave({ type: 'thinking', data: content.thinking.trim() });
      } else if (content.type === 'tool_use') {
        await this._handleToolUse(content, postMsg, sendAndSave);
      }
    }
  }

  private async _handleToolUse(
    content: any,
    postMsg: (msg: any) => void,
    sendAndSave: (msg: { type: string; data: any }) => void
  ): Promise<void> {
    const toolInfo = `🔧 Executing: ${content.name}`;
    let toolInput = '';
    let fileContentBefore: string | undefined;

    if (content.input) {
      // Special formatting for TodoWrite
      if (content.name === 'TodoWrite' && content.input.todos) {
        const todos = content.input.todos.map((todo: any) => ({
          content: todo.content,
          status: todo.status,
          activeForm: todo.activeForm
        }));
        this._callbacks.updateState({ currentTodos: todos });
        postMsg({ type: 'todosUpdated', data: todos });

        toolInput = '\nTodo List Update:';
        for (const todo of content.input.todos) {
          const status =
            todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '🔄' : '⏳';
          toolInput += `\n${status} ${todo.content}`;
        }
      }

      // For Edit/MultiEdit/Write, read current file content (before state)
      if (
        (content.name === 'Edit' || content.name === 'MultiEdit' || content.name === 'Write') &&
        content.input.file_path
      ) {
        fileContentBefore = await this._callbacks.readFile(content.input.file_path);
        if (fileContentBefore === undefined) {
          fileContentBefore = '';
        }
      }
    }

    // Compute startLine(s)
    let startLine: number | undefined;
    let startLines: number[] | undefined;

    if (fileContentBefore !== undefined) {
      if (content.name === 'Edit' && content.input.old_string) {
        const position = fileContentBefore.indexOf(content.input.old_string);
        if (position !== -1) {
          const textBefore = fileContentBefore.substring(0, position);
          startLine = (textBefore.match(/\n/g) || []).length + 1;
        } else {
          startLine = 1;
        }
      } else if (content.name === 'MultiEdit' && content.input.edits) {
        startLines = content.input.edits.map((edit: any) => {
          if (edit.old_string) {
            const position = fileContentBefore!.indexOf(edit.old_string);
            if (position !== -1) {
              const textBefore = fileContentBefore!.substring(0, position);
              return (textBefore.match(/\n/g) || []).length + 1;
            }
          }
          return 1;
        });
      }
    }

    sendAndSave({
      type: 'toolUse',
      data: {
        toolInfo,
        toolInput,
        rawInput: content.input,
        toolName: content.name,
        fileContentBefore,
        startLine,
        startLines,
        toolUseId: content.id
      }
    });
  }

  private async _handleUserMessage(
    jsonData: any,
    postMsg: (msg: any) => void,
    sendAndSave: (msg: { type: string; data: any }) => void,
    panelId?: string
  ): Promise<void> {
    if (!jsonData.message?.content) return;

    for (const content of jsonData.message.content) {
      if (content.type === 'tool_result') {
        await this._handleToolResult(content, postMsg, sendAndSave, panelId);
      }
    }
  }

  private async _handleToolResult(
    content: any,
    postMsg: (msg: any) => void,
    sendAndSave: (msg: { type: string; data: any }) => void,
    panelId?: string
  ): Promise<void> {
    let resultContent = content.content || 'Tool executed successfully';

    if (typeof resultContent === 'object' && resultContent !== null) {
      resultContent = JSON.stringify(resultContent, null, 2);
    }

    const isError = content.is_error || false;

    // Get the last tool use from conversation
    const conversation = this._callbacks.getConversation(panelId);
    const lastToolUse = conversation[conversation.length - 1];

    const toolName = lastToolUse?.data?.toolName;
    const rawInput = lastToolUse?.data?.rawInput;
    const startLine = lastToolUse?.data?.startLine;
    const startLines = lastToolUse?.data?.startLines;

    // Read file content after for diff display
    let fileContentAfter: string | undefined;
    if (
      (toolName === 'Edit' || toolName === 'MultiEdit' || toolName === 'Write') &&
      rawInput?.file_path &&
      !isError
    ) {
      fileContentAfter = await this._callbacks.readFile(rawInput.file_path);
    }

    // Don't send tool result for Read and TodoWrite unless there's an error
    if ((toolName === 'Read' || toolName === 'TodoWrite') && !isError) {
      sendAndSave({
        type: 'toolResult',
        data: {
          content: resultContent,
          isError,
          toolUseId: content.tool_use_id,
          toolName,
          rawInput,
          hidden: true
        }
      });
    } else {
      sendAndSave({
        type: 'toolResult',
        data: {
          content: resultContent,
          isError,
          toolUseId: content.tool_use_id,
          toolName,
          rawInput,
          fileContentAfter,
          startLine,
          startLines
        }
      });
    }
  }

  private _handleResultMessage(
    jsonData: any,
    postMsg: (msg: any) => void,
    state: StreamState,
    panelId?: string
  ): void {
    if (jsonData.subtype !== 'success') return;

    // Check for login errors
    if (jsonData.is_error && jsonData.result?.includes('Invalid API key')) {
      this._callbacks.handleLoginRequired();
      return;
    }

    this._callbacks.updateState({ isProcessing: false });

    // Capture session ID
    if (jsonData.session_id) {
      console.log('Session ID found in result:', {
        sessionId: jsonData.session_id,
        currentSessionId: state.currentSessionId
      });

      this._callbacks.updateState({ currentSessionId: jsonData.session_id });

      postMsg({
        type: 'sessionInfo',
        data: {
          sessionId: jsonData.session_id,
          tools: jsonData.tools || [],
          mcpServers: jsonData.mcp_servers || []
        }
      });
    }

    postMsg({ type: 'setProcessing', data: { isProcessing: false } });

    // Update cumulative tracking
    const newRequestCount = state.requestCount + 1;
    const newTotalCost = state.totalCost + (jsonData.total_cost_usd || 0);

    this._callbacks.updateState({
      requestCount: newRequestCount,
      totalCost: newTotalCost
    });

    console.log('Result received:', {
      cost: jsonData.total_cost_usd,
      duration: jsonData.duration_ms,
      turns: jsonData.num_turns
    });

    postMsg({
      type: 'updateTotals',
      data: {
        totalCost: newTotalCost,
        totalTokensInput: state.totalTokensInput,
        totalTokensOutput: state.totalTokensOutput,
        requestCount: newRequestCount,
        currentCost: jsonData.total_cost_usd,
        currentDuration: jsonData.duration_ms,
        currentTurns: jsonData.num_turns
      }
    });

    // Notify that response is complete (for system notifications)
    if (this._callbacks.onResponseComplete) {
      this._callbacks.onResponseComplete(panelId);
    }
  }
}
