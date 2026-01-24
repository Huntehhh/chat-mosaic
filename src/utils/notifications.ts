/**
 * Native system notifications for Claude Code Chat
 *
 * Uses PowerShell on Windows for global toast notifications,
 * with VS Code notification fallback for other platforms.
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { Platform } from './platform';

/**
 * Show a system notification when Claude finishes responding.
 * On Windows: Uses native toast notification (appears in Action Center)
 * On other platforms: Falls back to VS Code notification
 *
 * @param title - Notification title (chat name)
 * @param message - Message preview (100-200 chars)
 */
export function showResponseNotification(title: string, message: string): void {
  // Truncate message to 200 chars max
  const truncatedMessage = message.length > 200
    ? message.substring(0, 197) + '...'
    : message;

  if (Platform.isWindows) {
    showWindowsToast(title, truncatedMessage);
  } else {
    // macOS/Linux: Use VS Code notification (reliable and fast per Gemini recommendation)
    vscode.window.showInformationMessage(`${title}: ${truncatedMessage}`);
  }
}

/**
 * Escape text for use in XML content
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Show a native Windows toast notification using PowerShell
 * Uses spawn() to avoid cmd.exe shell escaping issues
 */
function showWindowsToast(title: string, message: string): void {
  // Escape for XML only (spawn bypasses cmd.exe shell issues)
  const safeTitle = escapeXml(title);
  const safeMessage = escapeXml(message);

  // Build the PowerShell script as a single command
  const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast><visual><binding template="ToastText02"><text id="1">${safeTitle}</text><text id="2">${safeMessage}</text></binding></visual><audio silent="true"/></toast>')
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code Chat').Show($toast)
`.trim();

  // Use spawn to bypass cmd.exe shell interpretation
  const ps = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    script
  ], {
    windowsHide: true,
    stdio: 'pipe'
  });

  ps.on('error', (error) => {
    console.error('[Notification] PowerShell spawn failed:', error.message);
    // Fallback to VS Code notification
    vscode.window.showInformationMessage(`${title}: ${message}`);
  });

  ps.stderr.on('data', (data) => {
    console.error('[Notification] PowerShell stderr:', data.toString());
  });

  ps.on('close', (code) => {
    if (code !== 0) {
      console.error('[Notification] PowerShell exited with code:', code);
      // Fallback to VS Code notification
      vscode.window.showInformationMessage(`${title}: ${message}`);
    }
  });
}

/**
 * Extract a preview from the last assistant message in a conversation
 *
 * @param conversation - The conversation array
 * @returns Message preview (up to 200 chars) or empty string if none found
 */
export function getLastAssistantMessagePreview(
  conversation: Array<{ timestamp: string; messageType: string; data: any }>
): string {
  // Find the last 'output' message (assistant text response)
  for (let i = conversation.length - 1; i >= 0; i--) {
    const msg = conversation[i];
    if (msg.messageType === 'output' && typeof msg.data === 'string') {
      // Clean up the message: remove markdown formatting, extra whitespace
      let preview = msg.data
        .replace(/```[\s\S]*?```/g, '[code]') // Replace code blocks
        .replace(/`[^`]+`/g, '[code]') // Replace inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
        .replace(/#{1,6}\s/g, '') // Remove heading markers
        .replace(/[*_~]+/g, '') // Remove bold/italic/strikethrough
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Return up to 200 chars
      if (preview.length > 200) {
        preview = preview.substring(0, 197) + '...';
      }

      return preview;
    }
  }
  return '';
}
