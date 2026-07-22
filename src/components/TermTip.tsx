import type { ReactNode } from 'react';
import { t } from '../i18n';

type Props = {
  /** i18n key for the hover explanation */
  hintKey: string;
  children: ReactNode;
  className?: string;
  as?: 'span' | 'small';
};

/** Lightweight dashed-term tooltip (keyboard-focusable). */
export function TermTip({ hintKey, children, className, as: Tag = 'span' }: Props) {
  const hint = t(hintKey);
  const label = typeof children === 'string' ? children : undefined;
  return (
    <Tag
      className={['term-tip', className].filter(Boolean).join(' ')}
      tabIndex={0}
      aria-label={label ? `${label}. ${hint}` : hint}
      data-tooltip={hint}
    >
      {children}
    </Tag>
  );
}
