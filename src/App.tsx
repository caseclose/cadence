import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { startTicker } from './scheduler/ticker';
import { notifyAll, reminderCopy, requestNotificationPermission } from './notify';
import { Task } from './scheduler/types';
import { TaskForm } from './components/TaskForm';
import { TaskCard } from './components/TaskCard';
import { ReminderModal } from './components/ReminderModal';
import { AuthBar } from './components/AuthBar';
import { ThemeToggle } from './components/ThemeToggle';
import { ProjectIntro } from './components/ProjectIntro';
import { UnlockVault } from './components/UnlockVault';
import { WebhookSettings } from './components/WebhookSettings';
import { DigestSettings } from './components/DigestSettings';
import { MemoModal } from './components/MemoModal';
import { LanguageToggle } from './components/LanguageToggle';
import { useLocale, t } from './i18n';
import { summarizeTasks } from './util/stats';
import { formatDuration } from './util/time';

export default function App() {
  useLocale();
  const {
    tasks,
    ready,
    user,
    cloudEnabled,
    e2eeLocked,
    init,
    addTask,
    applyAction,
    updateTaskNote,
    updateTaskTitle,
    deleteTask,
    reopenTask,
    exportJson,
    importJson,
  } = useStore();

  const canManageTasks = (!cloudEnabled || !!user) && !e2eeLocked;

  const [now, setNow] = useState(Date.now());
  const [queue, setQueue] = useState<string[]>([]); // ids of due tasks awaiting your response
  const [memoId, setMemoId] = useState<string | null>(null);
  const { events, templates, saveTemplate, deleteTemplate, addFromTemplate } = useStore();
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void init();
  }, [init]);

  // Keep relative times fresh.
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);

  // The single scheduler loop.
  useEffect(() => {
    const stop = startTicker({
      getTasks: () => useStore.getState().tasks,
      onDue: (task: Task) => {
        setQueue((q) => (q.includes(task.id) ? q : [...q, task.id]));
        const key = `${task.id}:${task.nextFireAt}`;
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          notifyAll(reminderCopy(task));
        }
      },
    });
    return stop;
  }, []);

  const activeTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.state !== 'done')
        .sort((a, b) => a.nextFireAt - b.nextFireAt || b.priority - a.priority),
    [tasks],
  );
  const doneTasks = useMemo(() => tasks.filter((t) => t.state === 'done'), [tasks]);
  const recentDoneTasks = useMemo(() => doneTasks.filter((t) => t.completedAt && now - t.completedAt <= 7 * 24 * 60 * 60_000), [doneTasks, now]);
  const stats = useMemo(() => summarizeTasks(tasks, events, now - 30 * 24 * 60 * 60_000), [tasks, events, now]);
  const archivedTasks = useMemo(() => doneTasks.filter((t) => !t.completedAt || now - t.completedAt > 7 * 24 * 60 * 60_000), [doneTasks, now]);

  const currentDue = useMemo(
    () => tasks.find((t) => t.id === queue[0]) ?? null,
    [tasks, queue],
  );
  const memoTask = useMemo(
    () => (memoId ? (tasks.find((t) => t.id === memoId) ?? null) : null),
    [tasks, memoId],
  );

  const closeCurrent = () => setQueue((q) => q.slice(1));

  const enableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
  };

  const onImport = () => {
    const json = window.prompt(t('importPrompt'));
    if (json) importJson(json);
  };

  const onExport = () => {
    const json = exportJson();
    void navigator.clipboard?.writeText(json);
    window.alert(t('exportCopied'));
  };

  useEffect(() => {
    const due = activeTasks.filter((task) => task.nextFireAt <= now).length;
    document.title = due ? `(${due}) Cadence` : activeTasks.length ? `(${Math.max(0, Math.ceil((activeTasks[0].nextFireAt - now) / 60_000))}m) Cadence` : 'Cadence';
    return () => { document.title = 'Cadence'; };
  }, [activeTasks, now]);

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-top">
          <div className="brand">
            <div className="brand-row">
              <span className="brand-mark" aria-hidden>◷</span>
              <span className="logo">Cadence</span>
            </div>
            <span className="brand-tagline">{t('brandTagline')}</span>
          </div>
          <div className="site-toolbar">
            <div className="toolbar-cluster">
              <LanguageToggle />
              <ThemeToggle />
              {notifPerm !== 'granted' && (
                <button type="button" className="toolbar-btn" onClick={enableNotifications}>
                  {t('enableWeb')}
                </button>
              )}
            </div>
            <AuthBar />
          </div>
        </div>
      </header>

      <main className="main">
        <ProjectIntro />
        {user && e2eeLocked && <UnlockVault />}
        {user && !e2eeLocked && <><WebhookSettings /><DigestSettings /></>}
        <TaskForm onAdd={addTask} disabled={!canManageTasks} />

        <section className="queue-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">{t('queueKicker')}</span>
              <h2>{t('queue')}</h2>
            </div>
            {canManageTasks && (
              <div className="tools">
                <button className="link" onClick={onExport}>
                  {t('export')}
                </button>
                <button className="link" onClick={onImport}>
                  {t('import')}
                </button>
              </div>
            )}
          </div>
          {!ready && <div className="empty">{t('loading')}</div>}
          {ready && !canManageTasks && user && e2eeLocked && (
            <div className="empty">{t('unlockToView')}</div>
          )}
          {ready && !canManageTasks && user && !e2eeLocked && (
            <div className="empty">{t('loginToView')}</div>
          )}
          {ready && !canManageTasks && !user && (
            <div className="empty">{t('loginToView')}</div>
          )}
          {ready && canManageTasks && activeTasks.length === 0 && (
            <div className="empty">{t('empty')}</div>
          )}
          <div className="task-list">
            {activeTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                now={now}
                onCheck={(id) => setQueue((q) => (q.includes(id) ? q : [id, ...q]))}
                onDelete={deleteTask}
                onOpenMemo={setMemoId}
                onUpdateTitle={updateTaskTitle}
                onSaveTemplate={(task) => saveTemplate({ title: task.title, note: task.note, strategy: task.strategy, etaMs: task.etaMs, priority: task.priority })}
              />
            ))}
          </div>
        </section>

        {recentDoneTasks.length > 0 && (
          <section>
            <div className="section-head"><h2>{t('completedRecent')}</h2></div>
            <div className="task-list">
              {recentDoneTasks.map((task) => (
                <TaskCard key={task.id} task={task} now={now} done onCheck={() => {}} onDelete={deleteTask} onOpenMemo={setMemoId} onUpdateTitle={updateTaskTitle} onReopen={reopenTask} />
              ))}
            </div>
          </section>
        )}

        <section className="stats-panel">
          <div className="section-head">
            <div>
              <span className="section-kicker">{t('statsKicker')}</span>
              <h2>{t('stats')}</h2>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-term" tabIndex={0} aria-label={`${t('completed')}. ${t('completedHint')}`} data-tooltip={t('completedHint')}>{t('completed')}</span>
              <strong>{stats.completed}</strong>
              <small>{t('stats30Days')}</small>
            </div>
            <div className="stat-card">
              <span className="stat-term" tabIndex={0} aria-label={`${t('etaRatio')}. ${t('etaRatioHint')}`} data-tooltip={t('etaRatioHint')}>{t('etaRatio')}</span>
              <strong>{stats.medianRatio === null ? '-' : `${Math.round(stats.medianRatio * 100)}%`}</strong>
              <small className="stat-term" tabIndex={0} aria-label={`${t('statsMedian')}. ${t('statsMedianHint')}`} data-tooltip={t('statsMedianHint')}>{t('statsMedian')}</small>
            </div>
            <div className="stat-card">
              <span className="stat-term" tabIndex={0} aria-label={`${t('p90')}. ${t('p90Hint')}`} data-tooltip={t('p90Hint')}>{t('p90')}</span>
              <strong>{stats.p90Ratio === null ? '-' : `${Math.round(stats.p90Ratio * 100)}%`}</strong>
              <small className="stat-term" tabIndex={0} aria-label={`${t('statsP90')}. ${t('statsP90Hint')}`} data-tooltip={t('statsP90Hint')}>{t('statsP90')}</small>
            </div>
          </div>
        </section>

        {templates.length > 0 && (
          <section className="templates-section">
            <div className="section-head"><div><span className="section-kicker">{t('templatesKicker')}</span><h2>{t('templates')}</h2></div></div>
            <div className="template-grid">{templates.map((template) => <article className="template-card" key={template.id}><div><strong>{template.title}</strong><span>{template.strategy === 'converging' ? t('convergingShort') : t('exponentialShort')} · ETA {formatDuration(template.etaMs)}</span></div><div className="task-actions"><button type="button" className="ghost" onClick={() => addFromTemplate(template.id)}>{t('useTemplate')}</button><button type="button" className="ghost danger" onClick={() => deleteTemplate(template.id)}>{t('delete')}</button></div></article>)}</div>
          </section>
        )}

        {archivedTasks.length > 0 && (
          <section>
            <div className="section-head"><h2>{t('archived')}</h2></div>
            <div className="task-list">
              {archivedTasks.map((task) => (
                <TaskCard key={task.id} task={task} now={now} done onCheck={() => {}} onDelete={deleteTask} onOpenMemo={setMemoId} onUpdateTitle={updateTaskTitle} onReopen={reopenTask} />
              ))}
            </div>
          </section>
        )}
      </main>

      {currentDue && (
        <ReminderModal
          task={currentDue}
          onResolve={applyAction}
          onClose={closeCurrent}
          onOpenMemo={setMemoId}
        />
      )}
      {memoTask && (
        <MemoModal
          task={memoTask}
          onSave={updateTaskNote}
          onClose={() => setMemoId(null)}
        />
      )}
    </div>
  );
}
