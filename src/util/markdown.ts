import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

/** Render Markdown to sanitized HTML suitable for dangerouslySetInnerHTML. */
export function renderMarkdown(src: string): string {
  const raw = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

/**
 * First meaningful line of a note, lightly stripped of Markdown markers,
 * truncated for task-card previews.
 */
export function noteSummary(note: string, maxLen = 80): string {
  const line =
    note
      .split('\n')
      .map((l) =>
        l
          .replace(/^#{1,6}\s+/, '')
          .replace(/^[-*+]\s+/, '')
          .replace(/^\d+\.\s+/, '')
          .replace(/`+/g, '')
          .replace(/\*\*/g, '')
          .trim(),
      )
      .find((l) => l.length > 0) ?? '';
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}
