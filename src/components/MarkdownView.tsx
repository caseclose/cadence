import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdown } from '../util/markdown';
import { useLocale, t } from '../i18n';

interface Props {
  source: string;
  className?: string;
}

/** Safe Markdown -> HTML view with copy controls for code blocks. */
export function MarkdownView({ source, className }: Props) {
  const locale = useLocale();
  const html = useMemo(() => renderMarkdown(source), [source]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const buttons: HTMLButtonElement[] = [];
    root.querySelectorAll('pre').forEach((pre) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'md-copy';
      button.title = t('copyCode');
      button.textContent = t('copy');
      const onClick = async () => {
        try {
          const text = pre.querySelector('code')?.textContent ?? '';
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(text);
          button.textContent = t('copied');
          window.setTimeout(() => { button.textContent = t('copy'); }, 1200);
        } catch {
          button.textContent = t('copyFailed');
          window.setTimeout(() => { button.textContent = t('copy'); }, 1200);
        }
      };
      button.addEventListener('click', onClick);
      pre.append(button);
      buttons.push(button);
    });
    return () => buttons.forEach((button) => button.remove());
  }, [html, locale]);

  return (
    <div
      ref={rootRef}
      className={`md-view${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
