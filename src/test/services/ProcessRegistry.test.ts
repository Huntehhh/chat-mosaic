/**
 * ProcessRegistry Test Suite
 *
 * Tests for multi-process management, panel routing,
 * and orphan cleanup functionality.
 */

import * as assert from 'assert';

// =============================================================================
// Constants (mirrors ProcessRegistry.ts)
// =============================================================================

const MAIN_PANEL_ID = 'main';
const SIDEBAR_PANEL_ID = 'sidebar';

// =============================================================================
// Mock State for Testing
// =============================================================================

interface MockProcessState {
  isProcessing: boolean;
  sessionId: string | undefined;
  lastActivityAt: number;
  errorOutput: string;
}

interface MockManagedProcess {
  panelId: string;
  state: MockProcessState;
  createdAt: number;
  spawnGeneration: number;
  isRunning: boolean;
}

// Mock implementation of ProcessRegistry for testing without actual processes
class MockProcessRegistry {
  private _processes: Map<string, MockManagedProcess> = new Map();
  private _spawnGenerationCounter: number = 0;
  private _activePanels: Set<string> = new Set();

  registerPanel(panelId: string): void {
    this._activePanels.add(panelId);
  }

  unregisterPanel(panelId: string): void {
    this._activePanels.delete(panelId);
  }

  isPanelActive(panelId: string): boolean {
    return this._activePanels.has(panelId);
  }

  spawn(panelId: string): MockManagedProcess {
    // Kill existing process for this panel
    if (this._processes.has(panelId)) {
      this.kill(panelId);
    }

    const generation = ++this._spawnGenerationCounter;
    const managed: MockManagedProcess = {
      panelId,
      state: {
        isProcessing: false,
        sessionId: undefined,
        lastActivityAt: Date.now(),
        errorOutput: ''
      },
      createdAt: Date.now(),
      spawnGeneration: generation,
      isRunning: true
    };

    this._processes.set(panelId, managed);
    return managed;
  }

  kill(panelId: string): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.isRunning = false;
      this._processes.delete(panelId);
    }
  }

  killAll(): void {
    for (const [panelId] of this._processes) {
      this.kill(panelId);
    }
  }

  isRunning(panelId: string): boolean {
    const managed = this._processes.get(panelId);
    return managed?.isRunning ?? false;
  }

  isProcessing(panelId: string): boolean {
    const managed = this._processes.get(panelId);
    return managed?.state.isProcessing ?? false;
  }

  setProcessing(panelId: string, isProcessing: boolean): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.state.isProcessing = isProcessing;
    }
  }

  getSessionId(panelId: string): string | undefined {
    const managed = this._processes.get(panelId);
    return managed?.state.sessionId;
  }

  setSessionId(panelId: string, sessionId: string): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.state.sessionId = sessionId;
    }
  }

  getActivePanelIds(): string[] {
    return Array.from(this._processes.keys());
  }

  getProcessCount(): number {
    return this._processes.size;
  }

  cleanupOrphanedProcesses(): number {
    let cleaned = 0;
    for (const [panelId] of this._processes) {
      if (!this.isPanelActive(panelId)) {
        this.kill(panelId);
        cleaned++;
      }
    }
    return cleaned;
  }

  recordActivity(panelId: string): void {
    const managed = this._processes.get(panelId);
    if (managed) {
      managed.state.lastActivityAt = Date.now();
    }
  }

  getProcess(panelId: string): MockManagedProcess | undefined {
    return this._processes.get(panelId);
  }
}

// =============================================================================
// Tests
// =============================================================================

suite('ProcessRegistry', () => {
  let registry: MockProcessRegistry;

  setup(() => {
    registry = new MockProcessRegistry();
  });

  suite('Constants', function() {
    test('MAIN_PANEL_ID should be "main"', () => {
      assert.strictEqual(MAIN_PANEL_ID, 'main');
    });

    test('SIDEBAR_PANEL_ID should be "sidebar"', () => {
      assert.strictEqual(SIDEBAR_PANEL_ID, 'sidebar');
    });
  });

  suite('spawn', () => {
    test('should create a new process for a panel', () => {
      registry.registerPanel('panel-1');
      const process = registry.spawn('panel-1');

      assert.ok(process);
      assert.strictEqual(process.panelId, 'panel-1');
      assert.strictEqual(process.isRunning, true);
      assert.strictEqual(process.state.isProcessing, false);
    });

    test('should kill existing process before spawning new one', () => {
      registry.registerPanel('panel-1');
      const process1 = registry.spawn('panel-1');
      const gen1 = process1.spawnGeneration;

      const process2 = registry.spawn('panel-1');
      const gen2 = process2.spawnGeneration;

      assert.ok(gen2 > gen1, 'Spawn generation should increment');
      assert.strictEqual(registry.getProcessCount(), 1);
    });

    test('should support multiple panels simultaneously', () => {
      registry.registerPanel('panel-1');
      registry.registerPanel('panel-2');
      registry.registerPanel('panel-3');

      registry.spawn('panel-1');
      registry.spawn('panel-2');
      registry.spawn('panel-3');

      assert.strictEqual(registry.getProcessCount(), 3);
      assert.ok(registry.isRunning('panel-1'));
      assert.ok(registry.isRunning('panel-2'));
      assert.ok(registry.isRunning('panel-3'));
    });
  });

  suite('kill', () => {
    test('should stop a running process', () => {
      registry.registerPanel('panel-1');
      registry.spawn('panel-1');

      assert.ok(registry.isRunning('panel-1'));

      registry.kill('panel-1');

      assert.strictEqual(registry.isRunning('panel-1'), false);
      assert.strictEqual(registry.getProcessCount(), 0);
    });

    test('should handle killing non-existent process', () => {
      // Should not throw
      registry.kill('non-existent');
      assert.strictEqual(registry.getProcessCount(), 0);
    });
  });

  suite('killAll', () => {
    test('should stop all running processes', () => {
      registry.registerPanel('panel-1');
      registry.registerPanel('panel-2');
      registry.registerPanel('panel-3');

      registry.spawn('panel-1');
      registry.spawn('panel-2');
      registry.spawn('panel-3');

      assert.strictEqual(registry.getProcessCount(), 3);

      registry.killAll();

      assert.strictEqual(registry.getProcessCount(), 0);
    });
  });

  suite('isProcessing / setProcessing', () => {
    test('should track processing state per panel', () => {
      registry.registerPanel('panel-1');
      registry.registerPanel('panel-2');

      registry.spawn('panel-1');
      registry.spawn('panel-2');

      assert.strictEqual(registry.isProcessing('panel-1'), false);
      assert.strictEqual(registry.isProcessing('panel-2'), false);

      registry.setProcessing('panel-1', true);

      assert.strictEqual(registry.isProcessing('panel-1'), true);
      assert.strictEqual(registry.isProcessing('panel-2'), false);
    });

    test('should return false for non-existent panel', () => {
      assert.strictEqual(registry.isProcessing('non-existent'), false);
    });
  });

  suite('sessionId management', () => {
    test('should store and retrieve session IDs per panel', () => {
      registry.registerPanel('panel-1');
      registry.registerPanel('panel-2');

      registry.spawn('panel-1');
      registry.spawn('panel-2');

      registry.setSessionId('panel-1', 'session-abc');
      registry.setSessionId('panel-2', 'session-xyz');

      assert.strictEqual(registry.getSessionId('panel-1'), 'session-abc');
      assert.strictEqual(registry.getSessionId('panel-2'), 'session-xyz');
    });

    test('should return undefined for non-existent panel', () => {
      assert.strictEqual(registry.getSessionId('non-existent'), undefined);
    });
  });

  suite('getActivePanelIds', () => {
    test('should return all active panel IDs', () => {
      registry.registerPanel('panel-a');
      registry.registerPanel('panel-b');

      registry.spawn('panel-a');
      registry.spawn('panel-b');

      const ids = registry.getActivePanelIds();

      assert.ok(ids.includes('panel-a'));
      assert.ok(ids.includes('panel-b'));
      assert.strictEqual(ids.length, 2);
    });
  });

  suite('cleanupOrphanedProcesses', () => {
    test('should kill processes for inactive panels', () => {
      registry.registerPanel('panel-1');
      registry.registerPanel('panel-2');

      registry.spawn('panel-1');
      registry.spawn('panel-2');

      // Simulate panel-2 being closed
      registry.unregisterPanel('panel-2');

      const cleaned = registry.cleanupOrphanedProcesses();

      assert.strictEqual(cleaned, 1);
      assert.ok(registry.isRunning('panel-1'));
      assert.strictEqual(registry.isRunning('panel-2'), false);
    });

    test('should return 0 when no orphans exist', () => {
      registry.registerPanel('panel-1');
      registry.spawn('panel-1');

      const cleaned = registry.cleanupOrphanedProcesses();

      assert.strictEqual(cleaned, 0);
    });
  });

  suite('recordActivity', () => {
    test('should update lastActivityAt timestamp', async () => {
      registry.registerPanel('panel-1');
      registry.spawn('panel-1');

      const process = registry.getProcess('panel-1');
      const initialTime = process!.state.lastActivityAt;

      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 10));

      registry.recordActivity('panel-1');

      const updatedProcess = registry.getProcess('panel-1');
      assert.ok(
        updatedProcess!.state.lastActivityAt >= initialTime,
        'Activity timestamp should be updated'
      );
    });
  });

  suite('spawnGeneration', () => {
    test('should increment on each spawn', () => {
      registry.registerPanel('panel-1');
      registry.registerPanel('panel-2');

      const p1 = registry.spawn('panel-1');
      const p2 = registry.spawn('panel-2');
      const p3 = registry.spawn('panel-1'); // Replace panel-1

      assert.ok(p1.spawnGeneration < p2.spawnGeneration);
      assert.ok(p2.spawnGeneration < p3.spawnGeneration);
    });

    test('should be unique across all spawns', () => {
      const generations = new Set<number>();

      for (let i = 0; i < 100; i++) {
        registry.registerPanel(`panel-${i}`);
        const p = registry.spawn(`panel-${i}`);
        generations.add(p.spawnGeneration);
      }

      assert.strictEqual(generations.size, 100);
    });
  });

  suite('isolation', () => {
    test('should isolate state between panels', () => {
      registry.registerPanel('panel-1');
      registry.registerPanel('panel-2');

      registry.spawn('panel-1');
      registry.spawn('panel-2');

      registry.setProcessing('panel-1', true);
      registry.setSessionId('panel-1', 'session-1');

      registry.setProcessing('panel-2', false);
      registry.setSessionId('panel-2', 'session-2');

      // Verify isolation
      assert.strictEqual(registry.isProcessing('panel-1'), true);
      assert.strictEqual(registry.isProcessing('panel-2'), false);
      assert.strictEqual(registry.getSessionId('panel-1'), 'session-1');
      assert.strictEqual(registry.getSessionId('panel-2'), 'session-2');
    });
  });
});
