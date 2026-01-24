# Test Cases: Multi-Panel State Isolation

**Created**: 2026-01-04
**Category**: Integration / E2E Testing
**Priority**: High

---

## Overview

These test cases verify that multiple Claude Code Chat panels can operate independently without state contamination. Each panel should maintain its own session, process, and UI state.

---

## Test Case 1: Independent Panel Processes

**Goal**: Verify each panel spawns and maintains its own Claude CLI process.

**Steps**:
1. Open Panel 1 via Ctrl+Shift+C
2. Send a message in Panel 1
3. Open Panel 2 via Ctrl+Shift+C (while Panel 1 is still open)
4. Check Developer Tools console for process spawn logs

**Expected**:
- Two separate `[ProcessRegistry] Spawned process for panel` log entries
- Different PIDs for each panel
- Each panel has unique `panelId` (e.g., "panel-1", "panel-2")

**Verification Command**:
```
// In Developer Tools console, look for:
[ProcessRegistry] Spawned process for panel panel-1, PID: XXXX
[ProcessRegistry] Spawned process for panel panel-2, PID: YYYY
```

---

## Test Case 2: Panel Closure Independence

**Goal**: Verify closing one panel does not affect another panel's process.

**Steps**:
1. Open Panel 1, send a message, wait for response
2. Open Panel 2, send a message, wait for response
3. Close Panel 2
4. Send another message in Panel 1

**Expected**:
- Panel 1 continues to respond normally after Panel 2 closes
- No "process not found" errors
- Panel 1's session ID remains intact

**Failure Indicators**:
- Panel 1 becomes unresponsive
- "No process found for panel" errors in console
- Panel 1 stuck on "processing" state

---

## Test Case 3: Concurrent Message Handling

**Goal**: Verify messages sent to multiple panels simultaneously are routed correctly.

**Steps**:
1. Open Panel 1 and Panel 2 side-by-side
2. Send a message in Panel 1 (e.g., "What is 2+2?")
3. Immediately send a different message in Panel 2 (e.g., "What is 3+3?")
4. Wait for both responses

**Expected**:
- Panel 1 receives answer "4" (or similar)
- Panel 2 receives answer "6" (or similar)
- No response appears in the wrong panel
- Both panels exit "processing" state correctly

**Failure Indicators**:
- Response appears in wrong panel
- One panel stuck on "processing"
- Duplicate responses

---

## Test Case 4: Session ID Isolation

**Goal**: Verify each panel maintains its own session ID.

**Steps**:
1. Open Panel 1, send a message
2. Note Panel 1's session ID from console logs
3. Open Panel 2, send a message
4. Note Panel 2's session ID from console logs
5. Send another message in Panel 1
6. Verify Panel 1 still uses its original session ID

**Expected**:
- Each panel logs its own session ID
- Panel 1's session ID doesn't change after Panel 2 opens
- Console shows: `[panel-1] Session ID selection: { panelSessionId: 'abc123' }`

**Verification Command**:
```
// Look for session ID selection logs:
[panel-1] Session ID selection: { panelFound: true, panelSessionId: 'abc123', ... }
[panel-2] Session ID selection: { panelFound: true, panelSessionId: 'def456', ... }
```

---

## Test Case 5: Same Conversation in Multiple Panels

**Goal**: Verify loading the same conversation in two panels works independently.

**Steps**:
1. Open Panel 1
2. Open history panel, select a conversation
3. Open Panel 2 via Ctrl+Shift+C (may load same conversation)
4. Send different messages in each panel

**Expected**:
- Both panels can operate independently
- Responses route to correct panel
- Closing either panel doesn't affect the other

---

## Test Case 6: Processing State Isolation

**Goal**: Verify "processing" indicator is panel-specific.

**Steps**:
1. Open Panel 1 and Panel 2
2. Send a long-running message in Panel 1 (e.g., "Write a 500-word essay")
3. While Panel 1 is processing, send a quick message in Panel 2
4. Panel 2 should respond while Panel 1 is still processing

**Expected**:
- Panel 2 shows "processing" then clears when its response arrives
- Panel 1 remains in "processing" until its response arrives
- Neither panel affects the other's processing state

---

## Test Case 7: New Session Independence

**Goal**: Verify starting a new session in one panel doesn't affect others.

**Steps**:
1. Open Panel 1, have an active conversation
2. Open Panel 2, have an active conversation
3. Click "New Session" in Panel 2
4. Verify Panel 1's conversation is unaffected

**Expected**:
- Panel 2 clears and starts fresh
- Panel 1 retains its conversation history
- Panel 1 can continue sending messages

---

## Automated Test Suggestions

For CI/CD integration, consider these automated checks:

```typescript
// Unit test: ProcessRegistry isolation
describe('ProcessRegistry', () => {
  it('should maintain separate processes per panelId', async () => {
    const registry = new ProcessRegistry(mockCallbacks);
    await registry.spawn('panel-1', config);
    await registry.spawn('panel-2', config);

    expect(registry.getActivePanelIds()).toHaveLength(2);
    expect(registry.getProcess('panel-1')).not.toBe(registry.getProcess('panel-2'));
  });

  it('should only kill specified panel process', async () => {
    await registry.kill('panel-2');

    expect(registry.isRunning('panel-1')).toBe(true);
    expect(registry.isRunning('panel-2')).toBe(false);
  });
});

// Unit test: Panel state isolation
describe('PanelState', () => {
  it('should not share sessionId between panels', () => {
    const panel1State = createPanelState();
    const panel2State = createPanelState();

    panel1State.sessionId = 'session-1';
    panel2State.sessionId = 'session-2';

    expect(panel1State.sessionId).not.toBe(panel2State.sessionId);
  });
});
```

---

## Console Log Patterns to Monitor

When testing, watch for these patterns in Developer Tools:

**Healthy**:
```
[panel-1] Session ID selection: { panelFound: true, panelSessionId: 'abc', ... }
[panel-2] Session ID selection: { panelFound: true, panelSessionId: 'def', ... }
```

**Problematic** (class-level fallback being used):
```
[panel-1] Session ID selection: { panelFound: true, panelSessionId: '(undefined)', willUse: 'xyz' }
```

**Problematic** (wrong panel receiving message):
```
[panel-1] Result message received  // But response appears in Panel 2
```

---

## Regression Checklist

Before each release, verify:

- [ ] Two panels can operate simultaneously
- [ ] Closing one panel doesn't break another
- [ ] Session IDs are panel-specific
- [ ] Processing state is panel-specific
- [ ] No "cross-talk" between panels
- [ ] New session in one panel doesn't affect others
