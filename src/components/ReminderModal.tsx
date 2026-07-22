import { useState } from 'react';
import { useLocale, t } from '../i18n';
import { Action, Task } from '../scheduler/types';
import { parseWhen, formatDuration, formatFireAt } from '../util/time';
import { WhenFormatGuide } from './WhenFormatGuide';
import { MarkdownView } from './MarkdownView';
import { TermTip } from './TermTip';

interface Props {
  task: Task;
  onResolve: (id: string, action: Action) => void;
  onClose: () => void;
  onOpenMemo?: (id: string) => void;
}

export function ReminderModal({ task, onResolve, onClose, onOpenMemo }: Props) {
  useLocale();
  const [reWhen, setReWhen] = useState('');
  const parsed = reWhen ? parseWhen(reWhen) : null;

  const act = (action: Action) => {
    onResolve(task.id, action);
    onClose();
  };

  const tomorrowMorningFireAt = () => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return next.getTime();
  };

  const hint =
    parsed && parsed.etaMs > 0
      ? parsed.kind === 'clock'
        ? t('reestimateHintClock', {
            time: formatFireAt(parsed.fireAt),
            duration: formatDuration(parsed.etaMs),
          })
        : t('reestimateHintDuration', { duration: formatDuration(parsed.etaMs) })
      : reWhen
        ? t('invalidWhen')
        : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal reminder-modal" onClick={(e) => e.stopPropagation()}>
        <header className="reminder-head">
          <span className="reminder-kicker"><TermTip hintKey="reminderKickerHint">{t('reminderKicker')}</TermTip></span>
          <h2 className="modal-title">{t('reminderTitle', { title: task.title })}</h2>
          <p className="modal-sub">
            {task.strategy === 'converging' ? t('convergingPrompt') : t('pollingPrompt')}
          </p>
        </header>

        {task.note?.trim() && (
          <button
            type="button"
            className="modal-memo"
            onClick={() => {
              onClose();
              onOpenMemo?.(task.id);
            }}
            title={t('openMemoEdit')}
          >
            <div className="modal-memo-top">
              <span className="modal-memo-label">{t('memo')}</span>
              <span className="modal-memo-edit-hint">{t('clickMemoEdit')}</span>
            </div>
            <MarkdownView source={task.note} className="modal-memo-body" />
          </button>
        )}

        <div className="modal-actions">
          <button type="button" className="primary reminder-done" onClick={() => act({ type: 'done' })}>
            {t('doneAction')}
          </button>
          <button type="button" className="reminder-secondary" onClick={() => act({ type: 'checked_not_done' })}>
            {t('notDone')}
          </button>
          <button type="button" className="reminder-secondary" onClick={() => act({ type: 'no_resources' })}>
            {t('noResources')}
          </button>
        </div>

        <div className="modal-snooze">
          <TermTip className="modal-snooze-label" hintKey="quickSnoozeHint">{t('quickSnooze')}</TermTip>
          <div className="modal-snooze-chips">
            <button type="button" className="snooze-chip" title={t('quickSnoozeHint')} onClick={() => act({ type: 'snooze', durationMs: 10 * 60_000 })}>
              {t('snooze10m')}
            </button>
            <button type="button" className="snooze-chip" title={t('quickSnoozeHint')} onClick={() => act({ type: 'snooze', durationMs: 60 * 60_000 })}>
              {t('snooze1h')}
            </button>
            <button type="button" className="snooze-chip" title={t('quickSnoozeHint')} onClick={() => act({ type: 'snooze', fireAt: tomorrowMorningFireAt() })}>
              {t('snoozeTomorrow')}
            </button>
          </div>
        </div>

        <div className="modal-reestimate">
          <input
            placeholder={t('reestimatePlaceholder')}
            value={reWhen}
            onChange={(e) => setReWhen(e.target.value)}
            title={t('reestimateTermHint')}
          />
          <button
            type="button"
            className="reminder-reestimate-btn"
            disabled={!parsed || parsed.etaMs <= 0}
            title={t('reestimateTermHint')}
            onClick={() => parsed && act({ type: 'reestimate', etaMs: parsed.etaMs })}
          >
            {t('reestimate')}
          </button>
        </div>
        {hint && <div className="hint">{hint}</div>}
        <WhenFormatGuide />
      </div>
    </div>
  );
}
