import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { createTask, schedule } from '../scheduler/backoff';
import { Action, BackoffConfig, DEFAULT_BACKOFF, Strategy, Task } from '../scheduler/types';
import { supabase, isCloudEnabled } from './supabase';
import { rowToTask, taskToRow, TaskRow } from './mapping';

const LS_TASKS = 'yield.tasks.v1';
const LS_CONFIG = 'yield.config.v1';

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
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

  signInWithEmail: (email: string) => Promise<void>;
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

export const useStore = create<StoreState>((set, get) => ({
  tasks: loadLocal<Task[]>(LS_TASKS, []),
  config: loadLocal<BackoffConfig>(LS_CONFIG, DEFAULT_BACKOFF),
  user: null,
  cloudEnabled: isCloudEnabled,
  ready: false,

  init: async () => {
    if (!supabase) {
      set({ ready: true });
      return;
    }

    const { data } = await supabase.auth.getSession();
    const session: Session | null = data.session;
    set({ user: session?.user ?? null });

    supabase.auth.onAuthStateChange((_event, s) => {
      set({ user: s?.user ?? null });
      if (s?.user) void get().init();
    });

    if (session?.user) {
      const uid = session.user.id;
      // Pull remote tasks, merge by updatedAt (last-write-wins).
      const { data: rows } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', uid);
      if (rows) {
        const remote = (rows as TaskRow[]).map(rowToTask);
        const byId = new Map<string, Task>();
        for (const t of get().tasks) byId.set(t.id, t);
        for (const t of remote) {
          const local = byId.get(t.id);
          if (!local || t.updatedAt >= local.updatedAt) byId.set(t.id, t);
        }
        const merged = [...byId.values()];
        set({ tasks: merged });
        saveLocal(LS_TASKS, merged);
        // Push any local-only tasks up.
        for (const t of merged) {
          if (!remote.find((r) => r.id === t.id)) void upsertRemote(t, uid);
        }
      }

      // Realtime: keep devices in sync.
      supabase
        .channel('tasks-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${uid}` },
          (payload) => {
            const cur = get().tasks;
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
            set({ tasks: next });
            saveLocal(LS_TASKS, next);
          },
        )
        .subscribe();
    }

    set({ ready: true });
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

  signInWithEmail: async (email) => {
    if (!supabase) return;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null });
  },

  exportJson: () => JSON.stringify({ tasks: get().tasks, config: get().config }, null, 2),

  importJson: (json) => {
    try {
      const parsed = JSON.parse(json) as { tasks?: Task[]; config?: BackoffConfig };
      const tasks = parsed.tasks ?? [];
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
