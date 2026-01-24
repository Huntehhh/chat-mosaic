# Master Test Cases Document

> **Analysis Sources**: Gemini 3 Pro Preview, Grok 4.1 Fast, Claude Opus 4.5
> **Date**: 2026-01-04
> **Current Coverage**: 198 passing tests

---

## Executive Summary

This document consolidates test case recommendations from multi-model AI analysis. The current test suite covers unit tests well but lacks **integration tests**, **security fuzzing**, and **edge case coverage** for critical paths.

---

## 1. CRITICAL: Security Test Cases

### 1.1 Permission Bypass Tests (PermissionsManager)

**Gap Identified**: Shell wrapper commands bypass blocklist patterns.

```typescript
// src/test/services/PermissionsManager.security.test.ts

suite('Permission Bypass Prevention', () => {
  // Shell wrapper escapes
  test('should block bash -c with dangerous command', () => {
    expect(isCommandBlocked('bash -c "rm -rf /"').blocked).toBe(true);
  });

  test('should block sh -c with dangerous command', () => {
    expect(isCommandBlocked('sh -c "sudo su"').blocked).toBe(true);
  });

  test('should block eval with dangerous command', () => {
    expect(isCommandBlocked('eval "rm -rf ~"').blocked).toBe(true);
  });

  // Chained command injection
  test('should block semicolon chained commands', () => {
    expect(isCommandBlocked('npm install; rm -rf /').blocked).toBe(true);
  });

  test('should block pipe to shell', () => {
    expect(isCommandBlocked('echo "rm -rf /" | bash').blocked).toBe(true);
  });

  test('should block && chained dangerous commands', () => {
    expect(isCommandBlocked('ls && rm -rf /').blocked).toBe(true);
  });

  // Obfuscation attempts
  test('should block commands with escaped spaces', () => {
    expect(isCommandBlocked('rm\\ -rf\\ /').blocked).toBe(true);
  });

  test('should block hex-encoded commands', () => {
    // Test after URL decoding
    const decoded = decodeURIComponent('%72%6d%20%2d%72%66%20%2f');
    expect(isCommandBlocked(decoded).blocked).toBe(true);
  });

  test('should block base64 decoded execution', () => {
    expect(isCommandBlocked('echo cm0gLXJmIC8= | base64 -d | bash').blocked).toBe(true);
  });

  // Environment variable injection
  test('should block $() command substitution', () => {
    expect(isCommandBlocked('echo $(rm -rf /)').blocked).toBe(true);
  });

  test('should block backtick command substitution', () => {
    expect(isCommandBlocked('echo `rm -rf /`').blocked).toBe(true);
  });
});

suite('ReDoS Prevention', () => {
  test('should reject nested quantifier patterns', () => {
    expect(pm['_matchesPattern']('test', '/(a+)+/')).toBe(false);
  });

  test('should reject exponential backtracking patterns', () => {
    expect(pm['_matchesPattern']('test', '/(a|a)+/')).toBe(false);
  });

  test('should timeout on pathological regex', () => {
    const start = Date.now();
    pm['_matchesPattern']('aaaaaaaaaaaaaaaaaaaaaa!', '/(a+)+b/');
    expect(Date.now() - start).toBeLessThan(100); // Should be fast
  });
});
```

### 1.2 CLI Argument Injection Tests

```typescript
// src/test/services/ProcessManager.security.test.ts

suite('CLI Argument Sanitization', () => {
  test('should reject nodePath with shell metacharacters', () => {
    expect(() => buildSpawnConfig({ nodePath: '; rm -rf /' }))
      .toThrow(/invalid.*path/i);
  });

  test('should reject claudePath with backticks', () => {
    expect(() => buildSpawnConfig({ claudePath: '`whoami`' }))
      .toThrow(/invalid.*path/i);
  });

  test('should reject paths with $() substitution', () => {
    expect(() => buildSpawnConfig({ nodePath: '$(malicious)' }))
      .toThrow(/invalid.*path/i);
  });

  test('should allow valid Unix paths', () => {
    expect(() => buildSpawnConfig({ nodePath: '/usr/bin/node' }))
      .not.toThrow();
  });

  test('should allow valid Windows paths', () => {
    expect(() => buildSpawnConfig({ nodePath: 'C:\\Program Files\\nodejs\\node.exe' }))
      .not.toThrow();
  });
});
```

### 1.3 Path Traversal Tests (ConversationManager)

```typescript
suite('Path Traversal Prevention', () => {
  test('should reject symlink to outside directory', async () => {
    // Create symlink pointing outside projects dir
    mockFs.realpathSync.mockReturnValue('/etc/passwd');
    await expect(cm.loadConversation('/projects/symlink.jsonl'))
      .rejects.toThrow(/path traversal/i);
  });

  test('should reject junction points on Windows', async () => {
    mockFs.realpathSync.mockReturnValue('C:\\Windows\\System32');
    await expect(cm.loadConversation('C:\\projects\\junction.jsonl'))
      .rejects.toThrow();
  });

  test('should reject UNC paths to network shares', async () => {
    await expect(cm.loadConversation('\\\\server\\share\\file.jsonl'))
      .rejects.toThrow();
  });
});
```

---

## 2. HIGH: Process Lifecycle Integration Tests

### 2.1 Full Spawn→Stream→Kill Cycle

```typescript
// src/test/integration/process-lifecycle.test.ts

suite('Process Lifecycle Integration', () => {
  test('should complete full lifecycle: spawn → stream → kill', async () => {
    const registry = createProcessRegistry();
    const messages: unknown[] = [];
    registry.setOnMessage((msg) => messages.push(msg));

    // Spawn
    await registry.spawn('panel-1', { cwd: '/project' });
    expect(registry.has('panel-1')).toBe(true);

    // Stream data
    mockProcess.stdout.emit('data', '{"type":"system","subtype":"init"}');
    await flushPromises();
    expect(messages.length).toBeGreaterThan(0);

    // Kill
    await registry.kill('panel-1');
    expect(registry.has('panel-1')).toBe(false);
  });

  test('should handle rapid spawn/kill cycles', async () => {
    const registry = createProcessRegistry();

    for (let i = 0; i < 10; i++) {
      await registry.spawn('panel-1', { cwd: '/project' });
      await registry.kill('panel-1');
    }

    expect(registry.has('panel-1')).toBe(false);
    expect(mockSpawn).toHaveBeenCalledTimes(10);
  });

  test('should escalate to SIGKILL after timeout', async () => {
    jest.useFakeTimers();
    const registry = createProcessRegistry();
    mockProcess.kill.mockImplementation(() => {}); // Ignore SIGTERM

    await registry.spawn('panel-1', { cwd: '/project' });
    const killPromise = registry.kill('panel-1');

    jest.advanceTimersByTime(7000); // Past SIGTERM timeout
    await killPromise;

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    jest.useRealTimers();
  });

  test('should cleanup on VS Code deactivate', async () => {
    const registry = createProcessRegistry();
    await registry.spawn('panel-1', { cwd: '/project1' });
    await registry.spawn('panel-2', { cwd: '/project2' });

    await registry.killAll();

    expect(registry.has('panel-1')).toBe(false);
    expect(registry.has('panel-2')).toBe(false);
  });
});
```

### 2.2 WSL Path Handling

```typescript
suite('WSL Path Handling', () => {
  beforeEach(() => mockPlatform('win32'));

  test('should convert Windows path to WSL mount path', () => {
    const result = convertToWSLPath('C:\\Users\\test\\project');
    expect(result).toBe('/mnt/c/Users/test/project');
  });

  test('should handle UNC WSL paths', () => {
    const result = normalizeWSLPath('\\\\wsl$\\Ubuntu\\home\\user');
    expect(result).toBe('/home/user');
  });

  test('should use consistent paths between ProcessManager and TerminalManager', async () => {
    const pm = createProcessManager({ wslEnabled: true });
    const tm = createTerminalManager({ wslEnabled: true });

    await pm.spawn({ cwd: 'C:\\Project' });
    tm.openTerminal({ cwd: 'C:\\Project' });

    // Both should use same path format
    expect(mockSpawn.mock.calls[0]).toContain('/mnt/c/Project');
    expect(mockTerminal.sendText.mock.calls[0]).toContain('/mnt/c/Project');
  });
});
```

### 2.3 Zombie Process Detection

```typescript
suite('Zombie Process Detection', () => {
  test('should detect unresponsive process via heartbeat', async () => {
    jest.useFakeTimers();
    const pm = createProcessManager();
    const onUnresponsive = jest.fn();
    pm.setOnUnresponsive(onUnresponsive);

    await pm.spawn({ cwd: '/project' });

    // No stdout for 3 minutes
    jest.advanceTimersByTime(180000);

    expect(onUnresponsive).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('should reset heartbeat on any stdout activity', async () => {
    jest.useFakeTimers();
    const pm = createProcessManager();
    const onUnresponsive = jest.fn();
    pm.setOnUnresponsive(onUnresponsive);

    await pm.spawn({ cwd: '/project' });

    // Activity at 2.5 minutes
    jest.advanceTimersByTime(150000);
    mockProcess.stdout.emit('data', '{"type":"ping"}');

    // Another 2.5 minutes (total 5min but heartbeat reset)
    jest.advanceTimersByTime(150000);

    expect(onUnresponsive).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
```

---

## 3. HIGH: Multi-Panel Race Condition Tests

```typescript
// src/test/integration/multi-panel.test.ts

suite('Multi-Panel Synchronization', () => {
  test('should not have race condition on concurrent spawn/kill', async () => {
    const registry = createProcessRegistry();

    // Simulate rapid panel switching
    const operations = [
      registry.spawn('panel-1', { cwd: '/p1' }),
      registry.kill('panel-1'),
      registry.spawn('panel-1', { cwd: '/p1' }),
      registry.spawn('panel-2', { cwd: '/p2' }),
      registry.kill('panel-2'),
    ];

    await Promise.all(operations);

    // Final state should be consistent
    expect(registry.has('panel-1')).toBe(true);
    expect(registry.has('panel-2')).toBe(false);
  });

  test('should route messages to correct panel', async () => {
    const registry = createProcessRegistry();
    const messages: Map<string, unknown[]> = new Map();

    registry.setOnMessage((msg, panelId) => {
      if (!messages.has(panelId)) messages.set(panelId, []);
      messages.get(panelId)!.push(msg);
    });

    await registry.spawn('panel-1', { cwd: '/p1' });
    await registry.spawn('panel-2', { cwd: '/p2' });

    // Simulate messages from different processes
    mockProcesses.get('panel-1').stdout.emit('data', '{"panel":"1"}');
    mockProcesses.get('panel-2').stdout.emit('data', '{"panel":"2"}');

    expect(messages.get('panel-1')?.[0]).toEqual({ panel: '1' });
    expect(messages.get('panel-2')?.[0]).toEqual({ panel: '2' });
  });

  test('should cancel pending permissions when panel closes', async () => {
    const provider = createClaudeChatProvider();

    // Open panel, trigger permission request
    await provider.show();
    provider._handleControlRequest({
      type: 'tool_use',
      name: 'Bash',
      input: { command: 'ls' },
      id: 'req-1'
    }, 'panel-1');

    // Close panel before user responds
    provider._disposePanel('panel-1');

    // Permission should be cancelled
    expect(provider._pendingPermissions.get('panel-1')).toBeUndefined();
  });
});
```

---

## 4. MEDIUM: Memory & Performance Tests

### 4.1 Large Conversation Handling

```typescript
suite('Large Conversation Performance', () => {
  test('should load 100MB conversation without OOM', async () => {
    const cm = createConversationManager();

    // Create mock 100MB JSONL file
    const largeFile = generateLargeJSONL(100 * 1024 * 1024);
    mockFs.readFile.mockResolvedValue(largeFile);

    const memBefore = process.memoryUsage().heapUsed;
    await cm.loadConversationWithPagination('/large.jsonl');
    const memAfter = process.memoryUsage().heapUsed;

    // Memory increase should be reasonable (< 200MB overhead)
    expect(memAfter - memBefore).toBeLessThan(200 * 1024 * 1024);
  });

  test('should paginate without loading entire file', async () => {
    const cm = createConversationManager();
    mockFs.stat.mockResolvedValue({ size: 50 * 1024 * 1024 });

    // Load first page
    await cm.loadConversationWithPagination('/large.jsonl');

    // Should only have PAGE_SIZE messages in memory
    expect(cm._parsedMessages.length).toBeLessThanOrEqual(100);
  });

  test('should handle pagination for 1M+ message conversations', async () => {
    const cm = createConversationManager();
    mockJsonlFile(1000000); // 1M messages

    let pagesLoaded = 0;
    while (cm.hasMoreMessages()) {
      await cm.loadMoreMessages();
      pagesLoaded++;
      if (pagesLoaded > 10) break; // Safety limit
    }

    expect(pagesLoaded).toBeGreaterThan(0);
  });
});
```

### 4.2 StreamBuffer Stress Tests

```typescript
suite('StreamBuffer Stress Tests', () => {
  test('should handle deeply nested JSON (100 levels)', () => {
    const buffer = new StreamBuffer();

    // Build deeply nested object
    let json = '"deepest"';
    for (let i = 0; i < 100; i++) {
      json = `{"level${i}":${json}}`;
    }

    const result = buffer.parse(json);
    expect(result.length).toBe(1);
  });

  test('should handle rapid small chunks', () => {
    const buffer = new StreamBuffer();
    const fullJson = '{"key":"value"}';

    // Send character by character
    for (const char of fullJson) {
      buffer.parse(char);
    }

    const remaining = buffer.flush();
    expect(remaining).toBeUndefined();
  });

  test('should handle 10MB message without crash', () => {
    const buffer = new StreamBuffer();
    const largeValue = 'x'.repeat(10 * 1024 * 1024);
    const json = `{"data":"${largeValue}"}`;

    expect(() => buffer.parse(json)).not.toThrow();
  });
});
```

---

## 5. MEDIUM: Frontend Component Tests

### 5.1 Zustand Store Tests

```typescript
// src/test/webview/stores/chatStore.test.ts

suite('ChatStore Edge Cases', () => {
  test('should handle concurrent permission updates', () => {
    const store = useChatStore.getState();

    // Simulate concurrent updates
    store.addPendingPermission({ id: '1', tool: 'Bash', input: {}, status: 'pending' });
    store.addPendingPermission({ id: '2', tool: 'Read', input: {}, status: 'pending' });
    store.updatePermissionStatus('1', 'approved');
    store.updatePermissionStatus('2', 'denied');

    const perms = useChatStore.getState().pendingPermissions;
    expect(perms.find(p => p.id === '1')?.status).toBe('approved');
    expect(perms.find(p => p.id === '2')?.status).toBe('denied');
  });

  test('should maintain message order during rapid updates', () => {
    const store = useChatStore.getState();
    store.clearMessages();

    // Rapid message additions
    for (let i = 0; i < 100; i++) {
      store.addMessage({ type: 'user', content: `msg-${i}`, timestamp: i });
    }

    const messages = useChatStore.getState().messages;
    expect(messages.length).toBe(100);
    expect(messages[0].content).toBe('msg-0');
    expect(messages[99].content).toBe('msg-99');
  });

  test('should handle image position stability', () => {
    const store = useChatStore.getState();

    store.addPendingImage({ id: '1', src: 'data:1', path: '/1.png' });
    store.addPendingImage({ id: '2', src: 'data:2', path: '/2.png' });
    store.removePendingImage('1');
    store.addPendingImage({ id: '3', src: 'data:3', path: '/3.png' });

    const images = useChatStore.getState().pendingImages;
    // Positions should be stable (2 keeps position, 3 gets new position)
    expect(images.find(i => i.id === '2')?.position).toBe(2);
    expect(images.find(i => i.id === '3')?.position).toBe(3);
  });
});
```

### 5.2 Message Handler Tests

```typescript
suite('useVSCodeMessaging Handler Tests', () => {
  test('should handle malformed messages gracefully', () => {
    const { result } = renderHook(() => useVSCodeMessaging());

    // Dispatch malformed message
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'unknown', invalid: true }
    }));

    // Should not crash
    expect(useChatStore.getState().messages.length).toBe(0);
  });

  test('should debounce rapid state updates', async () => {
    const { result } = renderHook(() => useVSCodeMessaging());

    // Rapid messages
    for (let i = 0; i < 100; i++) {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'streamingMessage', data: { content: `chunk-${i}` } }
      }));
    }

    await flushPromises();

    // Should have batched updates
    expect(useChatStore.getState().messages.length).toBeLessThan(100);
  });
});
```

---

## 6. LOW: Error Boundary Tests

```typescript
suite('React Error Boundaries', () => {
  test('should catch render errors in MessageBlock', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <ErrorBoundary>
        <MessageBlock message={{ type: 'invalid' as any, content: null }} />
      </ErrorBoundary>
    );

    expect(container.textContent).toContain('Something went wrong');
    errorSpy.mockRestore();
  });

  test('should recover from tool-use-block errors', () => {
    const { container, rerender } = render(
      <ErrorBoundary>
        <ToolUseBlock toolName={null as any} />
      </ErrorBoundary>
    );

    // Error shown
    expect(container.textContent).toContain('error');

    // Recovery on valid props
    rerender(
      <ErrorBoundary>
        <ToolUseBlock toolName="Bash" input={{ command: 'ls' }} />
      </ErrorBoundary>
    );

    expect(container.textContent).toContain('Bash');
  });
});
```

---

## Test Implementation Priority

| Priority | Category | Test Count | Effort |
|----------|----------|------------|--------|
| P0 | Security bypass tests | ~25 | Medium |
| P0 | Process lifecycle integration | ~15 | High |
| P1 | Multi-panel race conditions | ~10 | Medium |
| P1 | Memory/performance stress | ~10 | Medium |
| P2 | Frontend store edge cases | ~15 | Low |
| P2 | Error boundary tests | ~5 | Low |

**Total New Tests Recommended**: ~80

---

## Coverage Goals After Implementation

| Component | Current | Target |
|-----------|---------|--------|
| PermissionsManager | 85% | 98% |
| ProcessManager | 70% | 95% |
| ProcessRegistry | 75% | 90% |
| ConversationManager | 80% | 95% |
| StreamBuffer | 95% | 98% |
| Zustand Stores | 60% | 85% |
| React Components | 40% | 70% |

---

*Generated by multi-model analysis: Gemini 3 Pro Preview + Grok 4.1 Fast + Claude Opus 4.5*
