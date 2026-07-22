import { useState } from 'react';
import { useLocale, t } from '../i18n';
import { Action, Task } from '../scheduler/types';
import { parseWhen, formatDuration, formatFireAt } from '../util/time';
import { WhenFormatGuide } from './WhenFormatGuide';
import { MarkdownView } from './MarkdownView';

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

  const tomorrowMorning = () => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return Math.max(5 * 60_000, next.getTime() - Date.now());
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('reminderTitle', { title: task.title })}</div>
        <div className="modal-sub">
          {task.strategy === 'converging' ? t('convergingPrompt') : t('pollingPrompt')}
        </div>

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
            <div className="modal-memo-label">{t('memo')}</div>
            <MarkdownView source={task.note} className="modal-memo-body" />
            <div className="modal-memo-edit-hint">{t('clickMemoEdit')}</div>
          </button>
        )}

        <div className="modal-actions">
          <button type="button" className="primary" onClick={() => act({ type: 'done' })}>
            {t('doneAction')}
          </button>
          <button type="button" onClick={() => act({ type: 'checked_not_done' })}>
            {t('notDone')}
          </button>
          <button type="button" onClick={() => act({ type: 'no_resources' })}>
            {t('noResources')}
          </button>
        </div>

        <div className="modal-snooze">
          <span>{t('quickSnooze')}</span>
          <button type="button" onClick={() => act({ type: 'snooze', durationMs: 10 * 60_000 })}>{t('snooze10m')}</button>
          <button type="button" onClick={() => act({ type: 'snooze', durationMs: 60 * 60_000 })}>{t('snooze1h')}</button>
          <button type="button" onClick={() => act({ type: 'snooze', durationMs: tomorrowMorning() })}>{t('snoozeTomorrow')}</button>
        </div>

        <div className="modal-reestimate">
          <input
            placeholder={t('reestimatePlaceholder')}
            value={reWhen}
            onChange={(e) => setReWhen(e.target.value)}
          />
          <button
            type="button"
            disabled={!parsed || parsed.etaMs <= 0}
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
