import { useEffect, useRef, useState } from 'react';
import { Task } from '../scheduler/types';
import { MarkdownView } from './MarkdownView';

interface Props {
  task: Task;
  onSave: (id: string, note: string) => void;
  onClose: () => void;
}

/** Longer debounce cuts encrypted upsert chatter while typing. */
const AUTOSAVE_MS = 1200;

/**
 * Wide centered memo modal with debounced autosave.
 * Flushes on close, task switch, and unmount so drafts are not lost.
 */
export function MemoModal({ task, onSave, onClose }: Props) {
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
    saveState === 'pending' ? '保存中…' : saveState === 'saved' ? '已自动保存' : '自动保存';

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
              备忘录
            </div>
            <div className="memo-modal-task">{task.title}</div>
          </div>
          <button type="button" className="ghost" onClick={flushAndClose}>
            关闭
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
            编辑
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tab === 'preview' ? 'active' : ''}
            onClick={() => setTab('preview')}
          >
            预览
          </button>
        </div>

        <div className="memo-body">
          {tab === 'edit' ? (
            <textarea
              className="memo-editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                '支持 Markdown：\n# 标题\n- 检查清单\n`命令`\n```\n代码块\n```\n[链接](https://…)'
              }
              spellCheck={false}
              autoFocus
            />
          ) : draft.trim() ? (
            <MarkdownView source={draft} className="memo-preview" />
          ) : (
            <div className="memo-empty">还没有内容。切到「编辑」写点上下文吧。</div>
          )}
        </div>

        <div className="memo-modal-foot">
          <span className="memo-hint">支持标题、列表、代码块、链接 · 自动保存</span>
          <span className={`memo-save-status memo-save-${saveState}`} aria-live="polite">
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
