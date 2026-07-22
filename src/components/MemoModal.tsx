import { useEffect, useRef, useState } from 'react';
import { useLocale, t } from '../i18n';
import { Task } from '../scheduler/types';
import { MarkdownView } from './MarkdownView';

interface Props {
  task: Task;
  onSave: (id: string, note: string) => void;
  onClose: () => void;
}

const AUTOSAVE_MS = 1200;

export function MemoModal({ task, onSave, onClose }: Props) {
  useLocale();
  const [draft, setDraft] = useState(task.note ?? '');
  const [tab, setTab] = useState<'edit' | 'preview'>(task.note ? 'preview' : 'edit');
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saved'>('idle');

  const draftRef = useRef(draft);
  const taskIdRef = useRef(task.id);
  const lastSavedRef = useRef((task.note ?? '').trim());
  const onSaveRef = useRef(onSave);

  draftRef.current = draft;
  onSaveRef.current = onSave;

  const flushDraft = () => {
    const current = draftRef.current;
    if (current.trim() === lastSavedRef.current) return;
    onSaveRef.current(taskIdRef.current, current);
    lastSavedRef.current = current.trim();
    setSaveState('saved');
  };

  useEffect(() => {
    return () => {
      flushDraft();
    };
  }, []);

  useEffect(() => {
    if (taskIdRef.current === task.id) return;
    flushDraft();
    taskIdRef.current = task.id;
    lastSavedRef.current = (task.note ?? '').trim();
    setDraft(task.note ?? '');
    setTab(task.note ? 'preview' : 'edit');
    setSaveState('idle');
  }, [task.id, task.note]);

  useEffect(() => {
    if (draft.trim() === lastSavedRef.current) return;
    setSaveState('pending');
    const timer = window.setTimeout(() => {
      onSaveRef.current(task.id, draft);
      lastSavedRef.current = draft.trim();
      setSaveState('saved');
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, task.id]);

  const flushAndClose = () => {
    flushDraft();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const current = draftRef.current;
      if (current.trim() !== lastSavedRef.current) {
        onSaveRef.current(taskIdRef.current, current);
        lastSavedRef.current = current.trim();
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusLabel =
    saveState === 'pending' ? t('saving') : saveState === 'saved' ? t('saved') : t('autosave');

  return (
    <div className="modal-backdrop memo-backdrop" onClick={flushAndClose}>
      <div
        className="modal memo-modal"
        role="dialog"
        aria-labelledby="memo-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="memo-modal-head">
          <div>
            <div id="memo-modal-title" className="modal-title">
              {t('memo')}
            </div>
            <div className="memo-modal-task">{task.title}</div>
          </div>
          <button type="button" className="ghost" onClick={flushAndClose}>
            {t('close')}
          </button>
        </div>

        <div className="memo-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'edit'}
            className={tab === 'edit' ? 'active' : ''}
            onClick={() => setTab('edit')}
          >
            {t('memoEdit')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tab === 'preview' ? 'active' : ''}
            onClick={() => setTab('preview')}
          >
            {t('memoPreview')}
          </button>
        </div>

        <div className="memo-body">
          {tab === 'edit' ? (
            <textarea
              className="memo-editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('memoPlaceholderMd')}
              spellCheck={false}
              autoFocus
            />
          ) : draft.trim() ? (
            <MarkdownView source={draft} className="memo-preview" />
          ) : (
            <div className="memo-empty">{t('emptyMemo')}</div>
          )}
        </div>

        <div className="memo-modal-foot">
          <span className="memo-hint">{t('memoHint')}</span>
          <span className={`memo-save-status memo-save-${saveState}`} aria-live="polite">
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
