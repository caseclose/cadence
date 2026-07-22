import { useMemo } from 'react';
import { renderMarkdown } from '../util/markdown';

interface Props {
  source: string;
  className?: string;
}

/** Safe Markdown → HTML view. */
export function MarkdownView({ source, className }: Props) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  return (
    <div
      className={`md-view${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
