# Cross-Platform Support Implementation Plan v2

## Summary

Add macOS and Linux support to Claude Code Chat VS Code extension. Creates a platform abstraction layer to consolidate scattered `process.platform` checks and eliminate code duplication.

**Expert Reviews Incorporated:** Gemini 3 Pro, Grok 4.1 Fast

---

## Implementation Progress (Session 2025-12-30)

### All Phases Complete ✅

**Phase 1: Platform Abstraction Layer** - DONE
- [x] Created `src/utils/platform.ts` (~150 lines) - Platform detection, shell detection, WSL checks
- [x] Created `src/utils/shell.ts` (~180 lines) - Shell escaping for PowerShell, bash, zsh, fish
- [x] Created `src/utils/process-control.ts` (~180 lines) - Cross-platform spawn options, killProcessTree
- [x] Created `src/utils/paths.ts` (~180 lines) - Home dir, XDG paths, WSL conversion
- [x] Installed `cross-spawn` dependency and types

**Phase 2: Bug Fixes in extension.ts** - DONE
- [x] Fixed USERPROFILE bug (line 2261) - now uses `getClaudeProjectsPath()`
- [x] Removed duplicate `convertToWSLPath()` method - now imports from paths.ts
- [x] Updated spawn logic to use `Platform.isWindows` instead of `process.platform === 'win32'`
- [x] Updated kill logic to use `killProcessTree()` from process-control.ts
- [x] Added imports for new utilities (Platform, killProcessTree, getSpawnOptions, etc.)

**Phase 3: Refactor ProcessManager** - DONE
- [x] Imported Platform, escapePosixArg, isValidShellPath, convertToWSLPath, killProcessTree, killWSLProcess
- [x] Removed duplicate local functions (shellEscape, isWSLPath, isUNCPath, convertToWSLPath)
- [x] Updated `_spawnWSL()` to use `escapePosixArg()` and `Platform.isUnix`
- [x] Updated `_spawnNative()` to use `Platform.isWindows`
- [x] Updated `_killProcessGroup()` to use `killProcessTree()` and `killWSLProcess()`

**Phase 4: Refactor TerminalManager** - DONE
- [x] Imported Platform, getInstallCommand from platform.ts
- [x] Updated `_buildCommand()` to use `Platform.isWindows`
- [x] Updated `openUsageTerminal()` to use `Platform.isWindows`
- [x] Updated `runInstallCommand()` to use `getInstallCommand()`

**Phase 5: Update OpenCodeServerManager** - DONE
- [x] Imported Platform from utils/platform.ts
- [x] Updated spawn options `detached: Platform.isUnix`

**Phase 6: VS Code Settings** - DONE
- [x] Added `claudeCodeChat.claude.path` setting (custom CLI path)
- [x] Added `claudeCodeChat.shell.preferredShell` setting (auto/powershell/bash/zsh/fish)

**Phase 7: Enhance Notifications** - DONE
- [x] Imported Platform from utils/platform.ts
- [x] Updated to use `Platform.isWindows` with improved comment for macOS/Linux

**Additional Cleanup:**
- [x] Updated `claude-args.ts` to use Platform.isWindows
- [x] Updated `extension.ts` `_sendPlatformInfo()` to use Platform.name and Platform.isWindows
- [x] All `process.platform` checks now consolidated to platform.ts

**Build Status:** Compiles successfully with no errors

---

## Expert Review Consensus

### Architecture Decisions

| Decision | Gemini 3 Pro | Grok 4.1 Fast | Final Choice |
|----------|--------------|---------------|--------------|
| Process spawning lib | Consider `cross-spawn` | Use `cross-spawn` (~2KB) | `cross-spawn` |
| Process killing | Use `tree-kill` | Custom impl (tree-kill uses shell) | **Custom `killProcessTree()`** |
| Shell escaping | Write specific escapers | Avoid shell entirely, use arg arrays | Arg arrays + minimal escapers |
| Home directory | `os.homedir()` | `os.homedir()` | `os.homedir()` |
| DI framework | Not needed | Not needed (Interface + Factory) | Interface + Factory pattern |
| macOS notifications | VS Code notifications (osascript slow) | - | VS Code notifications |

### Key Technical Insights

1. **Process Groups (Unix)**: Use `process.kill(-pid)` (negative PID) for tree kill
2. **Process Groups (Windows)**: Use `taskkill /pid ${pid} /T /F`
3. **Avoid shell when possible**: Use arg arrays with `cross-spawn` to bypass escaping
4. **PowerShell on Windows**: Keep wrapper for path consistency (critical for Claude CLI)
5. **XDG compliance**: Check `$XDG_CONFIG_HOME` before falling back to `~/.config`
6. **macOS Gatekeeper**: Handle spawn failures gracefully with user prompts

---

## Critical Issues to Fix

| Issue | Location | Severity |
|-------|----------|----------|
| Duplicate spawn logic | `extension.ts:983-1013` duplicates `ProcessManager` | High |
| Duplicate kill logic | `extension.ts:1130-1142` duplicates `ProcessManager` | High |
| USERPROFILE bug | `extension.ts:2261` - doesn't exist on Unix | Critical |
| Duplicate `convertToWSLPath()` | `ProcessManager:60-90` AND `extension.ts:3328-3338` | Medium |
| No platform abstraction | Inline `process.platform` checks in 6 files | High |
| Incomplete shell escaping | Only bash escaping exists | Medium |

---

## Implementation Phases

### Phase 1: Create Platform Abstraction Layer

**New files to create:**

#### 1.1 `src/utils/platform.ts` (~100 lines)
```typescript
import * as os from 'os';

export const Platform = {
  isWindows: process.platform === 'win32',
  isMacOS: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  isUnix: process.platform !== 'win32',
  arch: process.arch,
};

export function getDefaultShell(): string {
  if (Platform.isWindows) return 'powershell.exe';
  return process.env.SHELL || '/bin/bash';
}

export function isWSLEnvironment(): boolean {
  return !!process.env.WSL_DISTRO_NAME;
}

export function getInstallCommand(): string {
  if (Platform.isWindows) {
    return 'irm https://claude.ai/install.ps1 | iex';
  }
  return 'curl -fsSL https://claude.ai/install.sh | sh';
}
```

#### 1.2 `src/utils/shell.ts` (~120 lines)
```typescript
export type ShellType = 'powershell' | 'bash' | 'zsh' | 'fish' | 'sh';

/**
 * Escape argument for POSIX shells (bash, zsh, sh)
 * Wraps in single quotes, escapes existing single quotes
 */
export function escapePosixArg(arg: string): string {
  if (/^[a-z0-9\\/._-]+$/i.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Escape argument for PowerShell
 * Single quotes with '' for escaping
 */
export function escapePowerShellArg(arg: string): string {
  if (/^[a-z0-9\\/._-]+$/i.test(arg)) return arg;
  return `'${arg.replace(/'/g, "''")}'`;
}

/**
 * Escape argument for Fish shell
 */
export function escapeFishArg(arg: string): string {
  if (/^[a-z0-9\\/._-]+$/i.test(arg)) return arg;
  return `'${arg.replace(/'/g, "\\'")}'`;
}

export function escapeArg(arg: string, shell: ShellType): string {
  switch (shell) {
    case 'powershell': return escapePowerShellArg(arg);
    case 'fish': return escapeFishArg(arg);
    default: return escapePosixArg(arg);
  }
}

export function detectShell(): ShellType {
  if (process.platform === 'win32') return 'powershell';
  const shell = process.env.SHELL || '/bin/bash';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('zsh')) return 'zsh';
  return 'bash';
}
```

#### 1.3 `src/utils/process-control.ts` (~100 lines)
```typescript
import * as cp from 'child_process';
import { promisify } from 'util';
import { Platform } from './platform';

const execAsync = promisify(cp.exec);

export interface SpawnOptions {
  cwd: string;
  detached?: boolean;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * Get platform-appropriate spawn options
 * Unix: detached creates process group for clean termination
 * Windows: detached not useful (use taskkill /T instead)
 */
export function getSpawnOptions(options: SpawnOptions): cp.SpawnOptions {
  return {
    cwd: options.cwd,
    detached: Platform.isUnix && (options.detached ?? true),
    shell: options.shell ?? false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...options.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1'
    }
  };
}

/**
 * Kill process and all children (cross-platform)
 * Custom implementation - avoids tree-kill's shell usage issues
 * Windows: taskkill /T for tree kill
 * Unix: kill process group with negative PID
 */
export async function killProcessTree(
  pid: number,
  signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'
): Promise<void> {
  if (Platform.isWindows) {
    try {
      await execAsync(`taskkill /pid ${pid} /T /F`);
    } catch (e: any) {
      // Ignore "not found" - process already dead
      if (!e.message?.includes('not found')) throw e;
    }
  } else {
    try {
      process.kill(-pid, signal);
    } catch (e: any) {
      if (e.code !== 'ESRCH') throw e; // ESRCH = no such process
    }
  }
}

/**
 * Kill WSL process (special handling)
 */
export async function killWSLProcess(
  pid: number,
  wslDistro: string
): Promise<void> {
  // Kill inside WSL
  try {
    await execAsync(`wsl -d ${wslDistro} pkill -9 -f "claude"`);
  } catch { /* Process may already be dead */ }
  // Also kill Windows-side wsl process
  try {
    await execAsync(`taskkill /pid ${pid} /T /F`);
  } catch { /* Process may already be dead */ }
}
```

#### 1.4 `src/utils/paths.ts` (~120 lines)
```typescript
import * as os from 'os';
import * as path from 'path';
import { Platform } from './platform';

/**
 * Get user home directory (cross-platform)
 * Uses os.homedir() which handles all platforms correctly
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Get config directory following platform standards
 * Windows: %APPDATA%
 * macOS: ~/Library/Application Support
 * Linux: $XDG_CONFIG_HOME or ~/.config
 */
export function getConfigDir(appName: string = 'claude'): string {
  if (Platform.isWindows) {
    return path.join(
      process.env.APPDATA || path.join(getHomeDir(), 'AppData', 'Roaming'),
      appName
    );
  }
  if (Platform.isMacOS) {
    return path.join(getHomeDir(), 'Library', 'Application Support', appName);
  }
  // Linux - XDG compliance
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return path.join(xdgConfig, appName);
  }
  return path.join(getHomeDir(), '.config', appName);
}

/**
 * Get data directory (XDG-compliant on Linux)
 */
export function getDataDir(appName: string = 'claude'): string {
  if (Platform.isLinux) {
    const xdgData = process.env.XDG_DATA_HOME;
    if (xdgData) {
      return path.join(xdgData, appName);
    }
    return path.join(getHomeDir(), '.local', 'share', appName);
  }
  return getConfigDir(appName);
}

/**
 * Get cache directory (XDG-compliant on Linux)
 */
export function getCacheDir(appName: string = 'claude'): string {
  if (Platform.isLinux) {
    const xdgCache = process.env.XDG_CACHE_HOME;
    if (xdgCache) {
      return path.join(xdgCache, appName);
    }
    return path.join(getHomeDir(), '.cache', appName);
  }
  return getConfigDir(appName);
}

/**
 * Get Claude CLI projects path
 * Claude stores projects in ~/.claude/projects/
 */
export function getClaudeProjectsPath(): string {
  return path.join(getHomeDir(), '.claude', 'projects');
}

// WSL Path Utilities (consolidated from ProcessManager)
export function isWSLPath(pathStr: string): boolean {
  return pathStr.startsWith('/');
}

export function isUNCPath(pathStr: string): boolean {
  return pathStr.startsWith('\\\\') || pathStr.startsWith('//');
}

export function convertToWSLPath(windowsPath: string): string {
  if (isWSLPath(windowsPath)) return windowsPath;

  if (isUNCPath(windowsPath)) {
    // Handle \\wsl$\distro\... paths
    const match = windowsPath.match(/^[\\\/]{2}wsl\$[\\\/]([^\\\/]+)[\\\/](.*)$/i);
    if (match) {
      return '/' + match[2].replace(/\\/g, '/');
    }
    console.warn('UNC paths not fully supported in WSL:', windowsPath);
    return windowsPath;
  }

  // Standard Windows path (e.g., C:\Users\...)
  const driveMatch = windowsPath.match(/^([a-zA-Z]):/);
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase();
    const rest = windowsPath.slice(2).replace(/\\/g, '/');
    return `/mnt/${drive}${rest}`;
  }

  return windowsPath.replace(/\\/g, '/');
}
```

---

### Phase 2: Fix Critical Bugs

#### 2.1 Fix USERPROFILE bug
**File:** `src/extension.ts:2261`
```typescript
// Before
const homeDir = process.env.HOME || process.env.USERPROFILE || '';

// After
import { getHomeDir } from './utils/paths';
const homeDir = getHomeDir();
```

#### 2.2 Remove duplicate `convertToWSLPath()`
- **DELETE:** `extension.ts:3328-3338`
- **KEEP:** Move `ProcessManager:60-90` to `paths.ts`
- **UPDATE:** Both files import from `paths.ts`

#### 2.3 Remove duplicate spawn/kill logic
**DELETE from `extension.ts`:**
- Lines 983-1013 (duplicate spawn logic)
- Lines 1130-1142 (duplicate kill logic)

**REPLACE with:**
```typescript
import { getSpawnOptions, killProcessTree } from './utils/process-control';
import spawn from 'cross-spawn';

// Spawn (using cross-spawn for reliability)
const opts = getSpawnOptions({ cwd, detached: true });
proc = spawn('claude', args, opts);

// Kill
await killProcessTree(pid, 'SIGKILL');
```

---

### Phase 3: Refactor ProcessManager

**File:** `src/services/ProcessManager.ts`

#### 3.1 Add cross-spawn dependency
```bash
npm install cross-spawn
npm install -D @types/cross-spawn
```

#### 3.2 Import new utilities
```typescript
import spawn from 'cross-spawn';
import { getSpawnOptions, killProcessTree, killWSLProcess } from '../utils/process-control';
import { convertToWSLPath, isWSLPath, isUNCPath } from '../utils/paths';
import { escapeArg } from '../utils/shell';
import { Platform } from '../utils/platform';
```

#### 3.3 Simplify `_spawnNative()` (lines 292-333)
- Keep PowerShell wrapper on Windows (critical for path consistency)
- Use `cross-spawn` for Unix
- Use `getSpawnOptions()` for platform-appropriate options

#### 3.4 Simplify `_killProcessGroup()` (lines 658-687)
- Replace inline logic with `killProcessTree()` / `killWSLProcess()`

---

### Phase 4: Refactor TerminalManager

**File:** `src/services/TerminalManager.ts`

#### 4.1 Update `_buildCommand()` (lines 106-124)
- Import `Platform` from platform utilities
- Use platform checks from utilities instead of inline

#### 4.2 Update `runInstallCommand()` (lines 394-401)
- Use `getInstallCommand()` from `platform.ts`

---

### Phase 5: Update OpenCodeServerManager

**File:** `src/services/backends/opencode/OpenCodeServerManager.ts:181`

```typescript
// Before
detached: process.platform !== 'win32',

// After
import { getSpawnOptions } from '../../utils/process-control';
const opts = getSpawnOptions({ cwd: this._cwd });
```

---

### Phase 6: VS Code Settings

**File:** `package.json`

```json
{
  "claudeCodeChat.claude.path": {
    "type": "string",
    "default": "",
    "description": "Custom Claude CLI path (auto-detected from PATH if empty)"
  },
  "claudeCodeChat.shell.preferredShell": {
    "type": "string",
    "enum": ["auto", "powershell", "bash", "zsh", "fish"],
    "default": "auto",
    "description": "Preferred shell for terminal commands (auto-detected if 'auto')"
  }
}
```

---

### Phase 7: Enhance Notifications

**File:** `src/utils/notifications.ts`

Per Gemini's recommendation, stick to VS Code notifications on macOS (osascript is slow):

```typescript
export function showResponseNotification(title: string, message: string): void {
  const truncatedMessage = message.length > 200
    ? message.substring(0, 197) + '...'
    : message;

  if (Platform.isWindows) {
    showWindowsToast(title, truncatedMessage);
  } else {
    // macOS/Linux: Use VS Code notification (reliable, fast)
    vscode.window.showInformationMessage(`${title}: ${truncatedMessage}`);
  }
}
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "cross-spawn": "^7.0.3"
  },
  "devDependencies": {
    "@types/cross-spawn": "^6.0.6"
  }
}
```

---

## Files Summary

### New Files (4)
| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/platform.ts` | ~100 | Platform detection, capabilities |
| `src/utils/shell.ts` | ~120 | Shell escaping, command building |
| `src/utils/process-control.ts` | ~100 | Spawn options, process termination |
| `src/utils/paths.ts` | ~120 | Home dir, XDG paths, WSL conversion |

### Modified Files (6)
| File | Changes |
|------|---------|
| `package.json` | Add cross-spawn dependency, new settings |
| `src/extension.ts` | Delete duplicate spawn/kill, fix homeDir bug, delete duplicate WSL func |
| `src/services/ProcessManager.ts` | Import utils, simplify spawn and kill |
| `src/services/TerminalManager.ts` | Update command building, install command |
| `src/services/backends/opencode/OpenCodeServerManager.ts` | Use getSpawnOptions |
| `src/utils/notifications.ts` | Simplify macOS (use VS Code notifications) |

---

## Priority Order

```
Phase 1 ─────► Phase 2 ─────► Phase 3 ─────► Phase 4
(Platform)    (Bug fixes)   (ProcessMgr)   (Terminal)
                                    │
                                    ▼
                              Phase 5 ─────► Phase 6 ─────► Phase 7
                              (OpenCode)    (Settings)    (Notifs)
```

| Phase | Priority | Effort |
|-------|----------|--------|
| 1: Platform Layer | P0 | ~2 hours |
| 2: Bug Fixes | P0 | ~30 min |
| 3: ProcessManager | P1 | ~1 hour |
| 4: TerminalManager | P1 | ~30 min |
| 5: OpenCodeServer | P2 | ~15 min |
| 6: VS Code Settings | P2 | ~30 min |
| 7: Notifications | P3 | ~15 min |

**Total: ~5-6 hours**

---

## Testing Checklist

- [ ] Windows 11 - existing functionality preserved
- [ ] Windows + WSL - still works
- [ ] macOS Intel - fresh install, spawn, kill
- [ ] macOS ARM (M1+) - fresh install, spawn, kill
- [ ] Ubuntu 22.04 - fresh install, XDG paths
- [ ] Debian 12 - spawn, kill
- [ ] Fedora 39+ - spawn, kill
- [ ] Shell detection: bash, zsh, fish
- [ ] Process termination (stop button works)
- [ ] Notifications appear correctly

---

## Success Criteria

1. All `process.platform` checks consolidated to `platform.ts`
2. No duplicate spawn/kill logic
3. Single `convertToWSLPath()` implementation
4. `os.homedir()` used for home directory
5. Shell escaping works for PowerShell, bash, zsh, fish
6. Extension loads and functions on Windows, macOS, Linux
7. Process spawning/termination reliable on all platforms
8. Bundle size increase < 5KB (cross-spawn only)

---

## Future Backend Pattern

Per Grok's recommendation, use Interface + Factory pattern for extensibility:

```typescript
// src/types/backend.ts
export interface CLIProvider {
  spawn(args: string[], opts: SpawnOptions): cp.ChildProcess;
  kill(pid: number): Promise<void>;
  getName(): string;
}

// src/services/backends/index.ts
export const providers: Record<string, CLIProvider> = {
  claude: new ClaudeProvider(),
  // opencode: new OpenCodeProvider(),
  // future: new FutureProvider(),
};

export function getProvider(name: string): CLIProvider {
  return providers[name] || providers.claude;
}
```

This scales to new backends with < 1 hour integration time.
