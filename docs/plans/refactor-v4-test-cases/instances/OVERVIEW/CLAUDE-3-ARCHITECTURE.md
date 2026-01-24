# CLAUDE-3: Architecture Overview

Integrations, utilities, and architectural improvements for the extension layer.

---

## Current Architecture

```
extension.ts (3,091 lines) - Monolithic provider
       │
       ├── ProcessRegistry      → Multi-panel process mgmt
       ├── ProcessManager       → Single process lifecycle
       ├── PermissionsManager   → Security checks
       ├── ConversationManager  → JSONL persistence
       ├── MessageRouter        → Command dispatching
       ├── TerminalManager      → Terminal integration
       ├── McpService           → MCP configuration
       ├── GitService           → Git operations
       └── backends/            → Backend adapters (facade-like)
           ├── BackendAdapter.ts
           ├── ClaudeBackend.ts
           └── OpenCodeBackend.ts
```

**Key Insight:** Uses **service composition** pattern. Backend adapters already provide facade-like abstraction for swappable backends.

---

## Phase 1: HIGH Priority (Utilities & Infrastructure)

### EventBus Utility ❌ NEW
```
ProcessRegistry spawns → eventBus.emit('process:spawned', { pid, panelId })
                                    ↓
                         PermissionsManager.on('process:spawned', logEvent)
```
Lightweight event system for loose coupling. Opt-in—doesn't require rewriting extension.ts. Enables new features to listen to system events without tight coupling.

### Debounce/Throttle Utilities ❌ NEW
```typescript
// Debounce: delay execution until quiet period
const saveSettings = debounce(() => writeFile(...), 500);

// Throttle: limit execution rate
const onScroll = throttle(() => savePosition(), 100);

// Rate limit: max calls per window
const apiCall = rateLimit(fetch, { maxCalls: 5, windowMs: 1000 });
```
General-purpose timing utilities. `MessageDebouncer` exists but is message-specific. These apply to any function.

### Cleanup Orphaned Processes ✅ VERIFY
```
Extension Activation → ProcessRegistry.cleanupOrphanedProcesses()
                                    ↓
                        Kill processes from crashed sessions
```
Method exists in ProcessRegistry:338-351. Verify it's called on startup to clean up zombie processes from previous crashes.

### CI/CD Enhancement ⚠️ IMPROVE
```
GitHub Actions → [Build] [Test] [Lint] [Package VSIX]
                    ↓
            Matrix: [Ubuntu, Windows, macOS] × [Node 18, 20]
                    ↓
            Upload artifacts, test results
```
Existing pipeline (40 lines) works. Add caching, coverage reporting, better artifact handling, and cross-platform testing.

### Integration Tests ❌ NEW
```
test/integration/
├── cli-communication.test.ts  # Process spawn/kill cycles
├── permission-flow.test.ts    # Command blocking flow
└── multi-panel.test.ts        # Panel isolation
```
End-to-end tests for critical flows. Unit tests exist for services, but integration coverage is minimal.

### Verify TerminalManager ✅ CHECK
```
TerminalManager methods:
├── openTerminal({ cwd, name })
├── executeInTerminal(command, { cwd, newTerminal })
├── closeTerminal(id)
└── closeAll()
```
Verify existing TerminalManager (13,931 bytes) has all needed methods. Enhance if missing features.

### Async Cleanup in Dispose ⚠️ CRITICAL
```
ClaudeChatProvider.dispose()
    ↓
await processRegistry.killAll() (with 5s timeout)
    ↓
Close panels, terminals, clear events
```
Ensure `dispose()` awaits process kills before cleaning up. Prevents orphaned processes when extension unloads.

### Architectural Recommendation
**Don't create facade layer on top of services.** The existing service composition pattern works well:

```
❌ BAD: extension.ts → ProcessFacade → ProcessRegistry → ProcessManager
                            ↓
                    Unnecessary indirection

✅ GOOD: extension.ts → ProcessRegistry → ProcessManager
                            ↓
            Direct composition, clear ownership
```

**Instead:**
1. **Enhance existing services** with event emission (opt-in EventBus)
2. **Add missing functionality** directly to services
3. **Use backend adapters** for swappable implementations (already done)
4. **Incrementally extract** pain points from extension.ts if needed

**Backend adapter pattern (already exists) IS a facade:**
```
extension.ts → BackendAdapter interface
                    ↓
        [ ClaudeBackend | OpenCodeBackend ]
                    ↓
        Swappable without changing extension.ts
```

---

## Phase 2: MEDIUM/LOW Priority (Service Enhancements)

### Enhanced McpService ⚠️ ENHANCE
```
McpService.addServer() → eventBus.emit('mcp:serverAdded')
                              ↓
                    UI updates MCP Manager Panel
```
Add event emission to existing McpService (7,175 bytes). Don't wrap with facade—enhance directly.

### Enhanced GitService ⚠️ ENHANCE
```
GitService.createBackup(msg?) → Stage all → Commit → Return BackupInfo
                                      ↓
                                { commitHash, timestamp, filesChanged }
```
Add backup/restore methods if missing. Integrates with VS Code's git extension API.

### Integration Tests for Services ❌ NEW
```
test/integration/
├── mcp-service.test.ts       # MCP event emission
├── git-service.test.ts       # Backup/restore flow
└── terminal-manager.test.ts  # Terminal lifecycle
```
Test enhanced services. Mock VS Code APIs (git extension, terminal creation) for isolated testing.

---

## Summary

**Phase 1 Focus:** Utilities (EventBus, debounce), verify cleanup on startup, verify TerminalManager completeness, ensure async dispose cleanup, apply architectural recommendations, enhance CI/CD, add integration tests.

**Phase 2 Focus:** Enhance existing services (McpService, GitService) with events and missing features.

**NOT Recommended:**
- Full extension.ts rewrite (3,091 lines → 500 lines via facades)
- Wrapping services with facades (adds indirection without benefit)
- Wholesale EventBus adoption (add incrementally for new features)

**Already Good:**
- Backend adapter pattern provides swappable backends
- Service composition pattern is clear and maintainable
- ProcessRegistry:338-351 has cleanupOrphanedProcesses()
- CI/CD pipeline exists and works
