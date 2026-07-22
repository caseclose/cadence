import { Task } from '../scheduler/types';
import { formatRelative, formatDuration } from '../util/time';
import { noteSummary } from '../util/markdown';
import { useState, type CSSProperties } from 'react';
import { useLocale, t } from '../i18n';

interface Props {
  task: Task;
  now: number;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenMemo?: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onReopen?: (id: string) => void;
  onSaveTemplate?: (task: Task) => void;
  done?: boolean;
}

export function TaskCard({
  task,
  now,
  onCheck,
  onDelete,
  onOpenMemo,
  onUpdateTitle,
  onReopen,
  onSaveTemplate,
  done,
}: Props) {
  useLocale();
  const stateLabel: Record<Task['state'], string> = {
    waiting: t('waiting'), due: t('due'), polling: t('polling'),
    snoozed: t('snoozed'), done: t('done'),
  };
  const overdue = !done && task.nextFireAt <= now && task.state !== 'done';
  const remainingRatio = Math.max(0, Math.min(1, (task.nextFireAt - now) / Math.max(task.etaMs, 1)));
  const urgency = done ? 'done' : overdue ? 'overdue' : remainingRatio > 0.6 ? 'fresh' : remainingRatio > 0.25 ? 'near' : 'urgent';
  const locked = task.title === '[e2ee]';
  const summary = task.note?.trim() ? noteSummary(task.note) : '';
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const saveTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== task.title) onUpdateTitle?.(task.id, next);
    setEditingTitle(false);
  };
  return (
    <div
      className={`card task task-urgency-${urgency} ${overdue ? 'overdue' : ''} ${done ? 'done-card' : ''}`}
      style={{ '--task-progress': `${Math.round((1 - remainingRatio) * 100)}%` } as CSSProperties}
    >
      <div className="task-main">
        {editingTitle ? (
          <input
            className="task-title-editor"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
            }}
            aria-label={t('editTaskTitle')}
          />
        ) : (
          <button
            type="button"
            className={`task-title task-title-button ${locked ? 'task-title-locked' : ''}`}
            disabled={locked || !onUpdateTitle}
            onClick={() => setEditingTitle(true)}
            title={locked ? t('lockedTitle') : t('editTitle')}
          >
            {locked ? t('taskLocked') : task.title}
          </button>
        )}
        {summary && !locked && (
          <button
            type="button"
            className="task-note-summary"
            onClick={() => onOpenMemo?.(task.id)}
            title={t('openMemo')}
          >
            {summary}
          </button>
        )}
        <div className="task-meta">
          <span className={`badge s-${task.state}`}>{stateLabel[task.state]}</span>
          <span className="badge strategy">
            {task.strategy === 'converging' ? t('convergingShort') : t('exponentialShort')}
          </span>
          <span>ETA {formatDuration(task.etaMs)}</span>
          {!done && (
            <>
              <span>· {t('reminderCount')} {task.attempts}</span>
              <span>· {formatRelative(task.nextFireAt, now)}</span>
            </>
          )}
        </div>
      </div>
      {!done && (
        <div className="task-actions">
          {onOpenMemo && !locked && (
            <button type="button" className="ghost" onClick={() => onOpenMemo(task.id)}>
              {task.note?.trim() ? t('memo') : t('writeMemo')}
            </button>
          )}
          {onSaveTemplate && <button type="button" className="ghost" onClick={() => onSaveTemplate(task)}>{t('saveTemplate')}</button>}
          <button type="button" className="ghost" onClick={() => onCheck(task.id)}>
            {t('viewNow')}
          </button>
          <button type="button" className="ghost danger" onClick={() => onDelete(task.id)}>
            {t('delete')}
          </button>
        </div>
      )}
      {done && (
        <div className="task-actions">
          {onOpenMemo && !locked && (
            <button type="button" className="ghost" onClick={() => onOpenMemo(task.id)}>
              {task.note?.trim() ? t('memo') : t('writeMemo')}
            </button>
          )}
          {onReopen && (
            <button type="button" className="ghost" onClick={() => onReopen(task.id)}>
              {t('reopen')}
            </button>
          )}
          <button type="button" className="ghost danger" onClick={() => onDelete(task.id)}>
            {t('delete')}
          </button>
        </div>
      )}
    </div>
  );
}
