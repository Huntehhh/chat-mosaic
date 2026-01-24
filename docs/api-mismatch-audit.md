# Backend/Frontend API Mismatch Audit

## Critical Mismatches (Message Type Names)

### Frontend Sends → Backend Expects

| Frontend Sends | Backend Expects | Status |
|----------------|-----------------|--------|
| `restoreToCommit` | `restoreCommit` | ❌ MISMATCH |
| `requestWorkspaceFiles` | `getWorkspaceFiles` | ❌ MISMATCH |
| `setSelectedModel` | `selectModel` | ❌ MISMATCH |
| `openUsageTerminal` | `viewUsage` | ❌ MISMATCH |
| `runInstall` | `runInstallCommand` | ❌ MISMATCH |
| `openFileInEditor` | `openFile` | ❌ MISMATCH |
| `createImage` | `createImageFile` | ❌ MISMATCH |
| `copyCode` | (not handled) | ❌ NOT HANDLED |
| `renameChat` | (not handled) | ❌ NOT HANDLED |

### Backend Sends → Frontend Handles

| Backend Sends | Frontend Expects | Status |
|---------------|------------------|--------|
| `clearLoading` | (not handled) | ❌ NOT HANDLED |
| `showInstallModal` | (not handled) | ❌ NOT HANDLED |
| `loginRequired` | (not handled) | ❌ NOT HANDLED |
| `restoreError` | (not handled) | ❌ NOT HANDLED |
| `restoreProgress` | (not handled) | ❌ NOT HANDLED |
| `checkpoints` | `checkpointsList` | ❌ MISMATCH |
| `permissionsData` | `permissionsList` | ❌ MISMATCH |
| `customSnippetsData` | `customSnippets` | ❌ MISMATCH |
| `mcpServerError` | (not handled) | ❌ NOT HANDLED |
| `mcpServerSaved` | (not handled) | ❌ NOT HANDLED |
| `mcpServerDeleted` | (not handled) | ❌ NOT HANDLED |
| `customSnippetSaved` | (not handled) | ❌ NOT HANDLED |
| `customSnippetDeleted` | (not handled) | ❌ NOT HANDLED |
| `system` | `systemMessage` | ❌ MISMATCH |
| `scrollToBottom` | (not handled) | ❌ NOT HANDLED |
| `imagePath` | (not handled) | ❌ NOT HANDLED |
| `expirePendingPermissions` | (not handled) | ❌ NOT HANDLED |
| `sessionResumed` | (not handled) | ❌ NOT HANDLED |

## Matching Messages ✅

### Frontend → Backend (Working)
- sendMessage, newSession, stopRequest
- getConversationList, loadConversation (fixed)
- getSettings, updateSettings, dismissWSLAlert
- selectImageFile, openDiff, openDiffByIndex
- permissionResponse, getPermissions, addPermission, removePermission
- loadMCPServers, saveMCPServer, deleteMCPServer
- getCustomSnippets, saveCustomSnippet, deleteCustomSnippet
- executeSlashCommand, enableYoloMode, saveInputText
- openModelTerminal, getClipboardText

### Backend → Frontend (Working)
- ready, sessionCleared, setProcessing, loading
- userInput, output, error, toolUse, toolResult
- updateTotals, updatePermissionStatus
- conversationList, workspaceFiles
- mcpServers, settingsData, platformInfo
- accountInfo, clipboardText, installComplete
- terminalOpened, modelSelected, restoreInputText, todosUpdated

## Priority Fixes Needed

### HIGH PRIORITY (Core Functionality)
1. `requestWorkspaceFiles` → `getWorkspaceFiles`
2. `setSelectedModel` → `selectModel`
3. `runInstall` → `runInstallCommand`
4. `openFileInEditor` → `openFile`
5. `checkpoints` → `checkpointsList`
6. `permissionsData` → `permissionsList`
7. `customSnippetsData` → `customSnippets`
8. `system` → `systemMessage`

### MEDIUM PRIORITY (Secondary Features)
9. `restoreToCommit` → `restoreCommit`
10. `openUsageTerminal` → `viewUsage`
11. `createImage` → `createImageFile`
12. Handle `clearLoading`, `showInstallModal`
13. Handle `mcpServerError`, `mcpServerSaved`, `mcpServerDeleted`

### LOW PRIORITY (Nice to Have)
14. Handle `scrollToBottom`
15. Handle `imagePath`
16. Handle `loginRequired`
17. Handle `restoreError`, `restoreProgress`
18. Handle `sessionResumed`
