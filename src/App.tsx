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

export default function App() {
  const {
    tasks,
    ready,
    user,
    cloudEnabled,
    init,
    addTask,
    applyAction,
    deleteTask,
    exportJson,
    importJson,
  } = useStore();

  const canManageTasks = !cloudEnabled || !!user;

  const [now, setNow] = useState(Date.now());
  const [queue, setQueue] = useState<string[]>([]); // ids of due tasks awaiting your response
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

  const currentDue = useMemo(
    () => tasks.find((t) => t.id === queue[0]) ?? null,
    [tasks, queue],
  );

  const closeCurrent = () => setQueue((q) => q.slice(1));

  const enableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
  };

  const onImport = () => {
    const json = window.prompt('粘贴导出的 JSON 以导入');
    if (json) importJson(json);
  };

  const onExport = () => {
    const json = exportJson();
    void navigator.clipboard?.writeText(json);
    window.alert('已复制备份 JSON 到剪贴板');
  };

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-top">
          <div className="brand">
            <div className="brand-row">
              <span className="brand-mark" aria-hidden>
                ◷
              </span>
              <span className="logo">Cadence</span>
            </div>
          </div>
          <div className="site-toolbar">
            <div className="toolbar-cluster">
              <ThemeToggle />
              {notifPerm !== 'granted' && (
                <button type="button" className="toolbar-btn" onClick={enableNotifications}>
                  开启通知
                </button>
              )}
            </div>
            <AuthBar />
          </div>
        </div>
      </header>

      <main className="main">
        <ProjectIntro />
        <TaskForm onAdd={addTask} disabled={!canManageTasks} />

        <section>
          <div className="section-head">
            <h2>挂起队列</h2>
            {canManageTasks && (
              <div className="tools">
                <button className="link" onClick={onExport}>
                  导出
                </button>
                <button className="link" onClick={onImport}>
                  导入
                </button>
              </div>
            )}
          </div>
          {!ready && <div className="empty">加载中…</div>}
          {ready && !canManageTasks && (
            <div className="empty">登录后查看和同步你的任务。</div>
          )}
          {ready && canManageTasks && activeTasks.length === 0 && (
            <div className="empty">还没有挂起的任务。上面挂起一个试试。</div>
          )}
          <div className="task-list">
            {activeTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                now={now}
                onCheck={(id) => setQueue((q) => (q.includes(id) ? q : [id, ...q]))}
                onDelete={deleteTask}
              />
            ))}
          </div>
        </section>

        {doneTasks.length > 0 && (
          <section>
            <div className="section-head">
              <h2>已完成</h2>
            </div>
            <div className="task-list">
              {doneTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  now={now}
                  done
                  onCheck={() => {}}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {currentDue && (
        <ReminderModal task={currentDue} onResolve={applyAction} onClose={closeCurrent} />
      )}
    </div>
  );
}
