import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { startTicker } from './scheduler/ticker';
import { notifyAll, reminderCopy, requestNotificationPermission } from './notify';
import { Task } from './scheduler/types';
import { TaskForm } from './components/TaskForm';
import { TaskCard } from './components/TaskCard';
import { ReminderModal } from './components/ReminderModal';
import { AuthBar } from './components/AuthBar';

export default function App() {
  const {
    tasks,
    ready,
    init,
    addTask,
    applyAction,
    deleteTask,
    exportJson,
    importJson,
  } = useStore();

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
      <header className="header">
        <div className="brand">
          <span className="logo">yield()</span>
          <span className="tagline">把 CPU 调度搬到你的多任务人生</span>
        </div>
        <div className="header-right">
          {notifPerm !== 'granted' && (
            <button className="link" onClick={enableNotifications}>
              开启通知
            </button>
          )}
          <AuthBar />
        </div>
      </header>

      <main className="main">
        <TaskForm onAdd={addTask} />

        <section>
          <div className="section-head">
            <h2>挂起队列</h2>
            <div className="tools">
              <button className="link" onClick={onExport}>
                导出
              </button>
              <button className="link" onClick={onImport}>
                导入
              </button>
            </div>
          </div>
          {!ready && <div className="empty">加载中…</div>}
          {ready && activeTasks.length === 0 && (
            <div className="empty">还没有挂起的任务。上面挂起一个试试。</div>
          )}
          {activeTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              now={now}
              onCheck={(id) => setQueue((q) => (q.includes(id) ? q : [id, ...q]))}
              onDelete={deleteTask}
            />
          ))}
        </section>

        {doneTasks.length > 0 && (
          <section>
            <div className="section-head">
              <h2>已完成</h2>
            </div>
            {doneTasks.map((t) => (
              <TaskCard key={t.id} task={t} now={now} onCheck={() => {}} onDelete={deleteTask} />
            ))}
          </section>
        )}
      </main>

      {currentDue && (
        <ReminderModal task={currentDue} onResolve={applyAction} onClose={closeCurrent} />
      )}
    </div>
  );
}
