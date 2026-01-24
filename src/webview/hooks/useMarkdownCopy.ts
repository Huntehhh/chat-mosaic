import { useEffect } from 'react';
import TurndownService from 'turndown';

/**
 * Configure Turndown for our markdown style
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',           // # style headers
    codeBlockStyle: 'fenced',      // ``` code blocks
    bulletListMarker: '-',         // - for lists
    emDelimiter: '*',              // *italic*
    strongDelimiter: '**',         // **bold**
  });

  // Custom rule for code blocks with language
  turndown.addRule('fencedCodeBlock', {
    filter: (node) => {
      return (
        node.nodeName === 'PRE' &&
        node.querySelector('code') !== null
      );
    },
    replacement: (_content, node) => {
      const codeEl = (node as HTMLElement).querySelector('code');
      if (!codeEl) return '';

      // Try to get language from class (e.g., "language-typescript")
      const langMatch = codeEl.className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : '';

      // Get the actual code content
      const code = codeEl.textContent || '';

      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
    },
  });

  // Custom rule for inline code
  turndown.addRule('inlineCode', {
    filter: (node) => {
      return (
        node.nodeName === 'CODE' &&
        node.parentNode?.nodeName !== 'PRE'
      );
    },
    replacement: (content) => {
      // Handle backticks in content
      if (content.includes('`')) {
        return '`` ' + content + ' ``';
      }
      return '`' + content + '`';
    },
  });

  // Keep line breaks in certain contexts
  turndown.addRule('lineBreak', {
    filter: 'br',
    replacement: () => '\n',
  });

  return turndown;
}

// Singleton turndown instance
let turndownInstance: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = createTurndownService();
  }
  return turndownInstance;
}

/**
 * Hook that intercepts copy events and converts HTML to Markdown.
 *
 * When the user selects and copies text from the chat, this hook will
 * convert the selected HTML content to Markdown format.
 */
export function useMarkdownCopy() {
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      // Get the selection as a document fragment
      const range = selection.getRangeAt(0);
      if (!range) return;

      // Clone the selected content
      const fragment = range.cloneContents();

      // Create a temporary container to hold the fragment
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      // Get the HTML content
      const htmlContent = tempDiv.innerHTML;

      // If there's no meaningful HTML (just text), let default behavior work
      if (!htmlContent || htmlContent === selection.toString()) {
        return;
      }

      // Convert HTML to Markdown
      const turndown = getTurndown();
      let markdown = turndown.turndown(htmlContent);

      // Clean up excessive whitespace but preserve intentional formatting
      markdown = markdown
        .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
        .trim();

      // If the conversion didn't produce anything different, use default
      if (!markdown || markdown === selection.toString().trim()) {
        return;
      }

      // Prevent default and set our markdown content
      e.preventDefault();

      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', markdown);
        // Also set as text/markdown for apps that support it
        e.clipboardData.setData('text/markdown', markdown);
      }
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);
}

export default useMarkdownCopy;
