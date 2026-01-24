/**
 * MCP Content Formatter
 * Converts JSON/HTML tool outputs into formatted Markdown for display
 */

/**
 * Check if a string looks like JSON
 */
function isJsonString(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

/**
 * Try to parse JSON, return null if invalid
 */
function tryParseJson(str: string): unknown | null {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Escape special Markdown characters in text that shouldn't be interpreted as Markdown
 */
function escapeMarkdownChars(text: string): string {
  // Escape pipe characters in table cells (but not in code)
  return text.replace(/\|/g, '\\|');
}

/**
 * Sanitize text to prevent XSS and rendering issues
 */
function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // Remove null bytes and other control characters (except newlines/tabs)
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Convert HTML table to Markdown table
 */
function htmlTableToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Extract rows from table - handle both thead/tbody and direct tr
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  const rows: string[][] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  rowRegex.lastIndex = 0;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowContent = match[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;

    // Reset cell regex for each row
    cellRegex.lastIndex = 0;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      // Clean the cell content - remove HTML tags, decode entities, trim whitespace
      let cellText = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\*\*/g, '') // Remove bold markers that might be inside
        .replace(/\n+/g, ' ') // Replace newlines with spaces in cells
        .trim();
      // Escape pipe characters in cell content
      cellText = escapeMarkdownChars(cellText);
      cells.push(cellText);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return '';

  // Determine max columns
  const maxCols = Math.max(...rows.map(r => r.length));
  if (maxCols === 0) return '';

  // Build Markdown table
  const lines: string[] = [];

  // Header row
  const headerRow = rows[0] || [];
  // Pad header to max columns
  while (headerRow.length < maxCols) {
    headerRow.push('');
  }
  lines.push('| ' + headerRow.map(cell => cell || ' ').join(' | ') + ' |');
  // Separator
  lines.push('| ' + headerRow.map(() => '---').join(' | ') + ' |');

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const row = [...rows[i]]; // Clone to avoid mutation
    // Pad row to match max columns
    while (row.length < maxCols) {
      row.push('');
    }
    lines.push('| ' + row.map(cell => cell || ' ').join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * Process HTML content - convert tables and clean up tags
 */
function processHtmlContent(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let result = sanitizeText(html);

  // Convert HTML tables to Markdown
  const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  result = result.replace(tableRegex, (tableHtml) => {
    const mdTable = htmlTableToMarkdown(tableHtml);
    return mdTable ? '\n\n' + mdTable + '\n\n' : '';
  });

  // Remove colgroup, col, thead, tbody, tfoot tags (structure only)
  result = result.replace(/<\/?colgroup[^>]*>/gi, '');
  result = result.replace(/<col[^>]*\/?>/gi, '');
  result = result.replace(/<\/?thead[^>]*>/gi, '');
  result = result.replace(/<\/?tbody[^>]*>/gi, '');
  result = result.replace(/<\/?tfoot[^>]*>/gi, '');

  // Handle pre-formatted code blocks
  result = result.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  result = result.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

  // Convert common HTML to Markdown
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<hr\s*\/?>/gi, '\n---\n');
  result = result.replace(/<\/p>/gi, '\n\n');
  result = result.replace(/<p[^>]*>/gi, '');
  result = result.replace(/<\/div>/gi, '\n');
  result = result.replace(/<div[^>]*>/gi, '');
  result = result.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  result = result.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
  result = result.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
  result = result.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
  result = result.replace(/<u>([\s\S]*?)<\/u>/gi, '_$1_');
  result = result.replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~');
  result = result.replace(/<strike>([\s\S]*?)<\/strike>/gi, '~~$1~~');
  result = result.replace(/<del>([\s\S]*?)<\/del>/gi, '~~$1~~');
  result = result.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');
  result = result.replace(/<mark>([\s\S]*?)<\/mark>/gi, '==$1==');
  result = result.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Handle span tags - just remove them but keep content
  result = result.replace(/<\/?span[^>]*>/gi, '');

  // Handle sub/sup
  result = result.replace(/<sub>([\s\S]*?)<\/sub>/gi, '~$1~');
  result = result.replace(/<sup>([\s\S]*?)<\/sup>/gi, '^$1^');

  // Handle abbr - just keep the text
  result = result.replace(/<abbr[^>]*>([\s\S]*?)<\/abbr>/gi, '$1');

  // Handle cite, q, dfn - just keep text
  result = result.replace(/<cite>([\s\S]*?)<\/cite>/gi, '*$1*');
  result = result.replace(/<q>([\s\S]*?)<\/q>/gi, '"$1"');
  result = result.replace(/<dfn>([\s\S]*?)<\/dfn>/gi, '*$1*');

  // Handle kbd, samp, var
  result = result.replace(/<kbd>([\s\S]*?)<\/kbd>/gi, '`$1`');
  result = result.replace(/<samp>([\s\S]*?)<\/samp>/gi, '`$1`');
  result = result.replace(/<var>([\s\S]*?)<\/var>/gi, '*$1*');

  // Handle small, big
  result = result.replace(/<\/?small[^>]*>/gi, '');
  result = result.replace(/<\/?big[^>]*>/gi, '');

  // Convert headers
  result = result.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  result = result.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  result = result.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  result = result.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  result = result.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  result = result.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Convert blockquotes
  result = result.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const lines = content.trim().split('\n');
    return '\n' + lines.map((line: string) => `> ${line}`).join('\n') + '\n';
  });

  // Convert lists - handle nested lists
  result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  result = result.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  // Decode HTML entities
  result = result.replace(/&nbsp;/gi, ' ');
  result = result.replace(/&amp;/gi, '&');
  result = result.replace(/&lt;/gi, '<');
  result = result.replace(/&gt;/gi, '>');
  result = result.replace(/&quot;/gi, '"');
  result = result.replace(/&#39;/gi, "'");
  result = result.replace(/&ndash;/gi, '–');
  result = result.replace(/&mdash;/gi, '—');
  result = result.replace(/&hellip;/gi, '…');
  result = result.replace(/&#(\d+);/gi, (_, code) => String.fromCharCode(parseInt(code, 10)));

  // Remove remaining HTML tags (but preserve content)
  result = result.replace(/<[^>]+>/g, '');

  // Clean up whitespace
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/[ \t]+\n/g, '\n'); // Remove trailing whitespace on lines
  result = result.trim();

  return result;
}

/**
 * Format a JSON value as Markdown
 * @param value - The value to format
 * @param depth - Current nesting depth (0 = top level)
 * @param maxDepth - Maximum depth before falling back to JSON
 */
function formatJsonValue(value: unknown, depth: number = 0, maxDepth: number = 5): string {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    try {
      return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
    } catch {
      return '*[complex nested value]*';
    }
  }

  if (value === null) {
    return '*null*';
  }

  if (value === undefined) {
    return '*undefined*';
  }

  if (typeof value === 'string') {
    // Empty string
    if (value.length === 0) {
      return '*empty string*';
    }

    // Sanitize the string
    const sanitized = sanitizeText(value);

    // Check if it's HTML content
    if (sanitized.includes('<table') || sanitized.includes('<tr') || sanitized.includes('<td') ||
        sanitized.includes('<div') || sanitized.includes('<p>') || sanitized.includes('<br')) {
      return processHtmlContent(sanitized);
    }

    // Check if it contains Markdown-like content (pass through)
    if (sanitized.includes('##') || sanitized.includes('**') || sanitized.includes('- ') ||
        sanitized.includes('```') || sanitized.includes('| ')) {
      return sanitized;
    }

    // Very long strings - truncate with note
    if (sanitized.length > 10000) {
      return sanitized.slice(0, 10000) + '\n\n*... (truncated, ' + sanitized.length + ' chars total)*';
    }

    return sanitized;
  }

  if (typeof value === 'number') {
    // Handle special numbers
    if (Number.isNaN(value)) return '*NaN*';
    if (!Number.isFinite(value)) return value > 0 ? '*Infinity*' : '*-Infinity*';
    return `\`${value}\``;
  }

  if (typeof value === 'boolean') {
    return `\`${value}\``;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '*empty array*';

    // Check if it's an array of simple values
    const allSimple = value.every(v => v === null || (typeof v !== 'object'));
    if (allSimple && value.length <= 10) {
      // Short simple arrays as inline code
      return value.map(v => v === null ? '*null*' : `\`${v}\``).join(', ');
    }

    // Very large arrays - summarize
    if (value.length > 50) {
      const preview = value.slice(0, 10).map((item, index) => {
        const formatted = formatJsonValue(item, depth + 1, maxDepth);
        return `${index + 1}. ${formatted}`;
      }).join('\n');
      return preview + `\n\n*... and ${value.length - 10} more items*`;
    }

    // Format as numbered list
    return value.map((item, index) => {
      const formatted = formatJsonValue(item, depth + 1, maxDepth);
      return `${index + 1}. ${formatted}`;
    }).join('\n');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.length === 0) return '*empty object*';

    // Very large objects - summarize
    if (keys.length > 30) {
      const preview = keys.slice(0, 15).map(key => {
        const val = obj[key];
        const formatted = formatJsonValue(val, depth + 1, maxDepth);
        if (depth === 0) {
          return `### ${key}\n${formatted}`;
        } else {
          return `**${key}:** ${formatted}`;
        }
      });
      return preview.join('\n\n') + `\n\n*... and ${keys.length - 15} more properties*`;
    }

    const lines: string[] = [];
    for (const key of keys) {
      const val = obj[key];
      // Skip undefined values
      if (val === undefined) continue;

      const formatted = formatJsonValue(val, depth + 1, maxDepth);

      // Use headers for top-level keys, bold for nested
      if (depth === 0) {
        lines.push(`### ${key}\n${formatted}`);
      } else {
        // For multiline values, put on new line
        if (formatted.includes('\n')) {
          lines.push(`**${key}:**\n${formatted}`);
        } else {
          lines.push(`**${key}:** ${formatted}`);
        }
      }
    }

    return lines.join('\n\n');
  }

  // Fallback for unknown types (symbols, functions, etc.)
  return `*[${typeof value}]*`;
}

/**
 * Extract and format MCP response content
 * Handles the common pattern of [{type: "text", text: "..."}]
 */
function formatMcpResponse(data: unknown): string {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return '*no content*';
  }

  // Handle array of content blocks (common MCP pattern)
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '*empty response*';
    }

    const parts: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];

      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;

        // Handle text content blocks (MCP standard)
        if (obj.type === 'text' && typeof obj.text === 'string') {
          let textContent = obj.text;

          // Try to parse the text as JSON (nested JSON is common)
          const parsedText = tryParseJson(textContent);
          if (parsedText !== null) {
            parts.push(formatJsonValue(parsedText));
          } else {
            // Process as HTML/Markdown
            parts.push(processHtmlContent(textContent));
          }
        }
        // Handle image content blocks
        else if (obj.type === 'image' && typeof obj.data === 'string') {
          const mimeType = obj.mimeType || 'image/png';
          parts.push(`*[Image: ${mimeType}]*`);
        }
        // Handle resource content blocks
        else if (obj.type === 'resource') {
          const uri = obj.uri || 'unknown';
          parts.push(`**Resource:** \`${uri}\``);
          if (obj.text && typeof obj.text === 'string') {
            parts.push(processHtmlContent(obj.text));
          }
        }
        // Handle error content blocks
        else if (obj.type === 'error' || obj.error) {
          const errorMsg = (obj.message || obj.error || 'Unknown error') as string;
          parts.push(`**Error:** ${errorMsg}`);
        }
        // Generic object - format as Markdown
        else {
          parts.push(formatJsonValue(obj));
        }
      } else if (typeof item === 'string') {
        // Plain string in array
        parts.push(processHtmlContent(item));
      } else {
        parts.push(formatJsonValue(item));
      }
    }

    // Join with separator only if multiple parts
    return parts.length > 1 ? parts.join('\n\n---\n\n') : parts[0] || '*empty*';
  }

  // Handle single object
  if (typeof data === 'object' && data !== null) {
    return formatJsonValue(data);
  }

  // Handle string directly
  if (typeof data === 'string') {
    return processHtmlContent(data);
  }

  return String(data);
}

/**
 * Format MCP tool input for display
 * Converts JSON input to readable Markdown
 */
export function formatMcpInput(input: Record<string, unknown> | string | null | undefined): string {
  if (!input) return '*no input*';

  if (typeof input === 'string') {
    // Try to parse as JSON
    const parsed = tryParseJson(input);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return formatMcpInputObject(parsed as Record<string, unknown>);
    }
    // Return sanitized string
    return sanitizeText(input);
  }

  if (typeof input !== 'object') {
    return String(input);
  }

  return formatMcpInputObject(input);
}

/**
 * Format MCP input object to Markdown
 */
function formatMcpInputObject(input: Record<string, unknown>): string {
  if (!input || typeof input !== 'object') return '*invalid input*';

  const keys = Object.keys(input);
  if (keys.length === 0) return '*empty input*';

  const lines: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    if (value === null) {
      lines.push(`**${key}:** *null*`);
    } else if (typeof value === 'string') {
      const sanitized = sanitizeText(value);
      // Check for URL patterns
      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('id') || key.toLowerCase().includes('path')) {
        lines.push(`**${key}:** \`${sanitized}\``);
      } else if (sanitized.length > 200) {
        // Long text - show on new line, possibly truncated
        const displayText = sanitized.length > 1000
          ? sanitized.slice(0, 1000) + '\n\n*... (truncated)*'
          : sanitized;
        lines.push(`**${key}:**\n${displayText}`);
      } else if (sanitized.length > 100) {
        lines.push(`**${key}:**\n${sanitized}`);
      } else {
        lines.push(`**${key}:** ${sanitized}`);
      }
    } else if (typeof value === 'object') {
      try {
        const jsonStr = JSON.stringify(value, null, 2);
        if (jsonStr.length > 2000) {
          lines.push(`**${key}:**\n\`\`\`json\n${jsonStr.slice(0, 2000)}\n... (truncated)\n\`\`\``);
        } else {
          lines.push(`**${key}:**\n\`\`\`json\n${jsonStr}\n\`\`\``);
        }
      } catch {
        lines.push(`**${key}:** *[complex object]*`);
      }
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`**${key}:** \`${value}\``);
    } else {
      lines.push(`**${key}:** ${String(value)}`);
    }
  }

  return lines.join('\n\n');
}

/**
 * Format MCP tool output for display
 * Converts JSON output to readable Markdown with proper formatting
 */
export function formatMcpOutput(output: string | null | undefined): string {
  if (!output) return '*no output*';
  if (typeof output !== 'string') return String(output);

  const sanitized = sanitizeText(output);
  if (!sanitized) return '*empty output*';

  // Try to parse as JSON
  const parsed = tryParseJson(sanitized);
  if (parsed !== null) {
    return formatMcpResponse(parsed);
  }

  // Check if it contains HTML that needs processing
  if (sanitized.includes('<table') || sanitized.includes('<tr') || sanitized.includes('<td') ||
      sanitized.includes('<div') || sanitized.includes('<p>')) {
    return processHtmlContent(sanitized);
  }

  // Return as-is (might already be Markdown)
  return sanitized;
}

/**
 * Check if content needs MCP formatting
 */
export function needsMcpFormatting(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false;

  // Check if it's JSON
  if (isJsonString(content)) return true;

  // Check if it has HTML elements
  if (content.includes('<table') || content.includes('<tr') ||
      content.includes('<div') || content.includes('<p>')) return true;

  return false;
}
