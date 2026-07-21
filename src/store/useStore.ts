import { create } from 'zustand';
import type { RealtimeChannel, Session, User } from '@supabase/supabase-js';
import { createTask, schedule } from '../scheduler/backoff';
import { Action, BackoffConfig, DEFAULT_BACKOFF, Strategy, Task } from '../scheduler/types';
import { supabase, isCloudEnabled } from './supabase';
import { rowToTask, taskToRow, TaskRow } from './mapping';
import { mapAuthError } from './authErrors';
import { usernameToEmail, validateUsername } from './username';
import { sanitizeTasks } from './taskSanitize';

const LS_TASKS = 'cadence.tasks.v1';
const LS_CONFIG = 'cadence.config.v1';

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Guard against corrupted localStorage (non-array JSON crashes React on .filter). */
function loadTasks(): Task[] {
  return sanitizeTasks(loadLocal<unknown>(LS_TASKS, []));
}

function loadConfig(): BackoffConfig {
  const data = loadLocal<unknown>(LS_CONFIG, DEFAULT_BACKOFF);
  if (!data || typeof data !== 'object') return DEFAULT_BACKOFF;
  return { ...DEFAULT_BACKOFF, ...(data as BackoffConfig) };
}

function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be full or blocked; non-fatal.
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface StoreState {
  tasks: Task[];
  config: BackoffConfig;
  user: User | null;
  cloudEnabled: boolean;
  ready: boolean;

  init: () => Promise<void>;
  addTask: (input: {
    title: string;
    note?: string;
    strategy: Strategy;
    etaMs: number;
    priority?: number;
  }) => void;
  applyAction: (id: string, action: Action) => void;
  deleteTask: (id: string) => void;
  setConfig: (patch: Partial<BackoffConfig>) => void;

  signInWithUsername: (username: string, password: string) => Promise<string | null>;
  signUpWithUsername: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  exportJson: () => string;
  importJson: (json: string) => void;
}

async function upsertRemote(task: Task, userId: string) {
  if (!supabase) return;
  await supabase.from('tasks').upsert(taskToRow(task, userId));
}

async function deleteRemote(id: string) {
  if (!supabase) return;
  await supabase.from('tasks').delete().eq('id', id);
}

let authListenerBound = false;
let realtimeChannel: RealtimeChannel | null = null;
let realtimeUid: string | null = null;

function mergeTasks(local: Task[], remote: Task[]): Task[] {
  const byId = new Map<string, Task>();
  for (const t of local) byId.set(t.id, t);
  for (const t of remote) {
    const prev = byId.get(t.id);
    if (!prev || t.updatedAt >= prev.updatedAt) byId.set(t.id, t);
  }
  return sanitizeTasks([...byId.values()]);
}

async function pullRemoteTasks(uid: string): Promise<Task[]> {
  if (!supabase) return [];
  const { data: rows, error } = await supabase.from('tasks').select('*').eq('user_id', uid);
  if (error) {
    console.error('pull tasks failed', error.message);
    return [];
  }
  return sanitizeTasks((rows as TaskRow[] | null)?.map(rowToTask) ?? []);
}

function bindRealtime(uid: string, get: () => StoreState, set: (partial: Partial<StoreState>) => void) {
  if (!supabase || realtimeUid === uid) return;
  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeUid = uid;
  realtimeChannel = supabase
    .channel(`tasks-sync-${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${uid}` },
      (payload) => {
        const cur = sanitizeTasks(get().tasks);
        if (payload.eventType === 'DELETE') {
          const next = cur.filter((t) => t.id !== (payload.old as TaskRow).id);
          set({ tasks: next });
          saveLocal(LS_TASKS, next);
          return;
        }
        const incoming = rowToTask(payload.new as TaskRow);
        const idx = cur.findIndex((t) => t.id === incoming.id);
        let next: Task[];
        if (idx === -1) next = [...cur, incoming];
        else if (incoming.updatedAt >= cur[idx].updatedAt) {
          next = [...cur];
          next[idx] = incoming;
        } else next = cur;
        next = sanitizeTasks(next);
        set({ tasks: next });
        saveLocal(LS_TASKS, next);
      },
    )
    .subscribe();
}

async function syncRemoteTasks(
  uid: string,
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
) {
  const remote = await pullRemoteTasks(uid);
  const merged = mergeTasks(get().tasks, remote);
  set({ tasks: merged });
  saveLocal(LS_TASKS, merged);
  for (const t of merged) {
    if (!remote.find((r) => r.id === t.id)) void upsertRemote(t, uid);
  }
  bindRealtime(uid, get, set);
}

export const useStore = create<StoreState>((set, get) => ({
  tasks: loadTasks(),
  config: loadConfig(),
  user: null,
  cloudEnabled: isCloudEnabled,
  ready: false,

  init: async () => {
    if (!supabase) {
      set({ ready: true });
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const session: Session | null = data.session;
      set({ user: session?.user ?? null });

      if (!authListenerBound) {
        authListenerBound = true;
        supabase.auth.onAuthStateChange((_event, s) => {
          set({ user: s?.user ?? null });
          if (s?.user) {
            void syncRemoteTasks(s.user.id, get, set).catch((err) =>
              console.error('sync after auth change failed', err),
            );
          } else {
            realtimeUid = null;
            if (realtimeChannel) {
              void supabase!.removeChannel(realtimeChannel);
              realtimeChannel = null;
            }
          }
        });
      }

      if (session?.user) {
        await syncRemoteTasks(session.user.id, get, set);
      }
    } catch (err) {
      console.error('init failed', err);
    } finally {
      set({ ready: true });
    }
  },

  addTask: (input) => {
    const now = Date.now();
    const task = createTask({ id: uuid(), ...input }, now);
    const next = [...get().tasks, task];
    set({ tasks: next });
    saveLocal(LS_TASKS, next);
    const uid = get().user?.id;
    if (uid) void upsertRemote(task, uid);
  },

  applyAction: (id, action) => {
    const now = Date.now();
    const cfg = get().config;
    let updated: Task | null = null;
    const next = get().tasks.map((t) => {
      if (t.id !== id) return t;
      updated = schedule(t, action, now, cfg);
      return updated;
    });
    set({ tasks: next });
    saveLocal(LS_TASKS, next);
    const uid = get().user?.id;
    if (uid && updated) void upsertRemote(updated, uid);
  },

  deleteTask: (id) => {
    const next = get().tasks.filter((t) => t.id !== id);
    set({ tasks: next });
    saveLocal(LS_TASKS, next);
    if (get().user?.id) void deleteRemote(id);
  },

  setConfig: (patch) => {
    const config = { ...get().config, ...patch };
    set({ config });
    saveLocal(LS_CONFIG, config);
  },

  signInWithUsername: async (username, password) => {
    if (!supabase) return '未配置云同步';
    if (!validateUsername(username)) return '用户名需 2–20 位（字母、数字、下划线、中文）';
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    return error ? mapAuthError(error.message) : null;
  },

  signUpWithUsername: async (username, password) => {
    if (!supabase) return '未配置云同步';
    if (!validateUsername(username)) return '用户名需 2–20 位（字母、数字、下划线、中文）';
    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password,
      options: { data: { username: username.trim() } },
    });
    if (error) return mapAuthError(error.message);
    if (!data.session) {
      return '注册失败：请在 Supabase 关闭 Confirm email（Authentication → Email），无需邮件即可登录。';
    }
    return null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null });
  },

  exportJson: () => JSON.stringify({ tasks: get().tasks, config: get().config }, null, 2),

  importJson: (json) => {
    try {
      const parsed = JSON.parse(json) as { tasks?: unknown; config?: BackoffConfig };
      const tasks = sanitizeTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
      set({ tasks });
      saveLocal(LS_TASKS, tasks);
      if (parsed.config) get().setConfig(parsed.config);
      const uid = get().user?.id;
      if (uid) for (const t of tasks) void upsertRemote(t, uid);
    } catch {
      // ignore malformed import
    }
  },
}));
