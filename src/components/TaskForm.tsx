import { FormEvent, useState } from 'react';
import { useLocale, t } from '../i18n';
import { Strategy } from '../scheduler/types';
import { parseWhen, formatDuration, formatFireAt } from '../util/time';
import { WhenFormatGuide } from './WhenFormatGuide';
import { parseTaskPrefill } from '../util/taskPrefill';
import { TermTip } from './TermTip';

interface Props {
  onAdd: (input: { title: string; note?: string; strategy: Strategy; etaMs: number }) => void;
  disabled?: boolean;
}

export function TaskForm({ onAdd, disabled }: Props) {
  useLocale();
  const prefill = parseTaskPrefill(typeof window === 'undefined' ? '' : window.location.search);
  const [title, setTitle] = useState(prefill.title ?? '');
  const [when, setWhen] = useState(prefill.when ?? '');
  const [strategy, setStrategy] = useState<Strategy>(prefill.strategy ?? 'converging');
  const [note, setNote] = useState(prefill.note ?? '');

  const parsed = when ? parseWhen(when) : null;
  const canSubmit = !disabled && title.trim().length > 0 && parsed !== null && parsed.etaMs > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !parsed) return;
    onAdd({ title: title.trim(), note: note.trim() || undefined, strategy, etaMs: parsed.etaMs });
    setTitle('');
    setWhen('');
    setNote('');
    setStrategy('converging');
  };

  const hint = (() => {
    if (!when) return null;
    if (!parsed) return t('parseHint');
    if (parsed.kind === 'clock') {
      return t('reminderAt', {
        time: formatFireAt(parsed.fireAt),
        duration: formatDuration(parsed.etaMs),
      });
    }
    return t('firstReminderIn', { duration: formatDuration(parsed.etaMs) });
  })();

  return (
    <form className={`card form-card form${disabled ? ' form-disabled' : ''}`} onSubmit={submit}>
      <h3 className="form-card-title"><TermTip hintKey="suspendHint">{t('formTitle')}</TermTip></h3>
      {disabled && <p className="form-login-hint">{t('loginFirst')}</p>}
      <input
        className="field-full"
        placeholder={t('taskName')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={disabled}
      />
      <input
        className="field-full"
        placeholder={t('when')}
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        disabled={disabled}
      />
      <div className="form-actions-row">
        <select
          className="field-strategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as Strategy)}
          aria-label={`${t('backoffStrategy')}. ${t('backoffStrategyHint')}`}
          title={t(strategy === 'converging' ? 'convergingHint' : 'exponentialHint')}
          disabled={disabled}
        >
          <option value="converging" title={t('convergingHint')}>{t('converging')}</option>
          <option value="exponential" title={t('exponentialHint')}>{t('exponential')}</option>
        </select>
        <button type="submit" className="btn-submit" disabled={!canSubmit} title={t('suspendHint')}>
          {t('suspend')}
        </button>
      </div>
      <textarea
        className="field-full subtle note-field"
        rows={3}
        placeholder={t('memoPlaceholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={disabled}
      />
      {hint && <div className="hint">{hint}</div>}
      <WhenFormatGuide />
    </form>
  );
}
