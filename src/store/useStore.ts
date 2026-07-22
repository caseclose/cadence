import { create } from 'zustand';
import type { RealtimeChannel, Session, User } from '@supabase/supabase-js';
import {
  clearKeyringSession,
  getDek,
  isKeyringUnlocked,
  lockKeyring,
  persistKeyringSession,
  setupKeyring,
  tryRestoreKeyringSession,
  unlockKeyring,
  userHasE2EE,
} from '../crypto/keyring';
import { createTask, schedule } from '../scheduler/backoff';
import { Action, BackoffConfig, DEFAULT_BACKOFF, Strategy, Task } from '../scheduler/types';
import { t } from '../i18n';
import { supabase, isCloudEnabled } from './supabase';
import { rowToTask, taskToRow, TaskRow } from './mapping';
import { mapAuthError } from './authErrors';
import { usernameToEmail, validateUsername } from './username';
import { sanitizeTasks } from './taskSanitize';
import { ensurePushSubscription, subscribeToPush, unsubscribeFromPush } from '../notify/push';

const LS_TASKS_LEGACY = 'cadence.tasks.v1';
const LS_TASKS_PREFIX = 'cadence.tasks.v1.';
const LS_CONFIG = 'cadence.config.v1';

function tasksKey(uid: string): string {
  return `${LS_TASKS_PREFIX}${uid}`;
}

function loadTasksForUser(uid: string | null): Task[] {
  if (!uid) return [];
  return sanitizeTasks(loadLocal<unknown>(tasksKey(uid), []));
}

function loadInitialTasks(): Task[] {
  if (isCloudEnabled) return [];
  return sanitizeTasks(loadLocal<unknown>(LS_TASKS_LEGACY, []));
}

function saveTasks(tasks: Task[], uid: string | null) {
  if (isCloudEnabled) {
    if (!uid) return;
    saveLocal(tasksKey(uid), tasks);
    return;
  }
  saveLocal(LS_TASKS_LEGACY, tasks);
}

function localTasksForSync(get: () => StoreState, uid: string): Task[] {
  const cached = loadTasksForUser(uid);
  if (get().user?.id !== uid) return cached;
  return mergeTasks(cached, sanitizeTasks(get().tasks));
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadTasks(): Task[] {
  return loadInitialTasks();
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

function syncE2EEFlags(user: User | null): Pick<StoreState, 'e2eeEnabled' | 'e2eeLocked'> {
  const enabled = userHasE2EE(user);
  return {
    e2eeEnabled: enabled,
    e2eeLocked: enabled && !isKeyringUnlocked(),
  };
}

interface StoreState {
  tasks: Task[];
  config: BackoffConfig;
  user: User | null;
  cloudEnabled: boolean;
  ready: boolean;
  e2eeEnabled: boolean;
  e2eeLocked: boolean;

  init: () => Promise<void>;
  addTask: (input: {
    title: string;
    note?: string;
    strategy: Strategy;
    etaMs: number;
    priority?: number;
  }) => void;
  applyAction: (id: string, action: Action) => void;
  reopenTask: (id: string) => void;
  updateTaskNote: (id: string, note: string) => void;
  updateTaskTitle: (id: string, title: string) => void;
  syncWebhookContent: () => Promise<void>;
  deleteTask: (id: string) => void;
  setConfig: (patch: Partial<BackoffConfig>) => void;

  signInWithUsername: (username: string, password: string) => Promise<string | null>;
  signUpWithUsername: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  unlockVault: (password: string) => Promise<string | null>;
  enablePush: () => Promise<string | null>;
  disablePush: () => Promise<string | null>;
  exportJson: () => string;
  importJson: (json: string) => void;
}

async function upsertRemote(task: Task, userId: string) {
  if (!supabase) return;
  const { data: hooks } = await supabase
    .from('notification_webhooks')
    .select('include_content')
    .eq('user_id', userId)
    .eq('enabled', true);
  const includeWebhookContent = (hooks ?? []).some(
    (hook) => hook.include_content === true,
  );
  const row = await taskToRow(task, userId, getDek(), includeWebhookContent);
  await supabase.from('tasks').upsert(row);
}

async function deleteRemote(id: string) {
  if (!supabase) return;
  await supabase.from('tasks').delete().eq('id', id);
}

let authListenerBound = false;
let realtimeChannel: RealtimeChannel | null = null;
let realtimeUid: string | null = null;
/** When set, auth listener waits so it does not race password unlock. */
let e2eeUnlockInFlight: Promise<string | null> | null = null;

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
  const dek = getDek();
  const tasks: Task[] = [];
  for (const row of (rows as TaskRow[] | null) ?? []) {
    const task = await rowToTask(row, dek);
    if (task) tasks.push(task);
  }
  return sanitizeTasks(tasks);
}

async function applyIncomingRow(
  row: TaskRow,
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
) {
  if (get().e2eeLocked) return;
  const incoming = await rowToTask(row, getDek());
  if (!incoming) return;
  const cur = sanitizeTasks(get().tasks);
  const idx = cur.findIndex((t) => t.id === incoming.id);
  let next: Task[];
  if (idx === -1) next = [...cur, incoming];
  else if (incoming.updatedAt >= cur[idx].updatedAt) {
    next = [...cur];
    next[idx] = incoming;
  } else next = cur;
  next = sanitizeTasks(next);
  set({ tasks: next });
  saveTasks(next, get().user?.id ?? null);
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
        if (payload.eventType === 'DELETE') {
          const cur = sanitizeTasks(get().tasks);
          const next = cur.filter((t) => t.id !== (payload.old as TaskRow).id);
          set({ tasks: next });
          saveTasks(next, get().user?.id ?? null);
          return;
        }
        void applyIncomingRow(payload.new as TaskRow, get, set);
      },
    )
    .subscribe();
}

async function syncRemoteTasks(
  uid: string,
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
) {
  if (get().e2eeLocked) {
    const local = loadTasksForUser(uid);
    set({ tasks: local });
    bindRealtime(uid, get, set);
    return;
  }

  const remote = await pullRemoteTasks(uid);
  const merged = mergeTasks(localTasksForSync(get, uid), remote);
  set({ tasks: merged });
  saveTasks(merged, uid);
  if (isKeyringUnlocked()) {
    for (const t of merged) {
      void upsertRemote(t, uid);
    }
  }
  bindRealtime(uid, get, set);
}

async function ensureE2EEWithPassword(user: User, username: string, password: string): Promise<string | null> {
  if (!supabase) return t('errCloudNotConfigured');

  const work = (async (): Promise<string | null> => {
    try {
      if (userHasE2EE(user)) {
        await unlockKeyring(user, password);
      } else {
        const e2eeMeta = await setupKeyring(password);
        const { error } = await supabase!.auth.updateUser({
          data: { username: username.trim(), ...e2eeMeta },
        });
        if (error) return mapAuthError(error.message);
      }
      await persistKeyringSession(user.id);
      return null;
    } catch {
      return t('errWrongPassword');
    }
  })();

  e2eeUnlockInFlight = work;
  void work.finally(() => {
    if (e2eeUnlockInFlight === work) e2eeUnlockInFlight = null;
  });
  return work;
}

function clearSessionTasks(set: (partial: Partial<StoreState>) => void, userId?: string | null) {
  realtimeUid = null;
  if (realtimeChannel && supabase) {
    void supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  lockKeyring();
  clearKeyringSession(userId ?? undefined);
  void unsubscribeFromPush().catch(() => {
    /* best-effort */
  });
  set({ tasks: [], e2eeEnabled: false, e2eeLocked: false });
}

async function restoreE2EEFlags(user: User | null): Promise<{
  e2eeEnabled: boolean;
  e2eeLocked: boolean;
}> {
  const flags = syncE2EEFlags(user);
  if (!user || !flags.e2eeLocked) return flags;
  const ok = await tryRestoreKeyringSession(user.id);
  if (!ok) return flags;
  return { e2eeEnabled: true, e2eeLocked: false };
}

export const useStore = create<StoreState>((set, get) => ({
  tasks: loadTasks(),
  config: loadConfig(),
  user: null,
  cloudEnabled: isCloudEnabled,
  ready: false,
  e2eeEnabled: false,
  e2eeLocked: false,

  init: async () => {
    if (!supabase) {
      set({ ready: true });
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const session: Session | null = data.session;
      const user = session?.user ?? null;
      const e2eeFlags = await restoreE2EEFlags(user);
      set({ user, ...e2eeFlags });

      if (!authListenerBound) {
        authListenerBound = true;
        supabase.auth.onAuthStateChange((_event, s) => {
          void (async () => {
            if (!s?.user) {
              clearSessionTasks(set, get().user?.id);
              set({ user: null });
              return;
            }
            // Wait for in-flight password unlock so we don't briefly lock + sync mid-login.
            if (e2eeUnlockInFlight) await e2eeUnlockInFlight;
            const flags = await restoreE2EEFlags(s.user);
            set({ user: s.user, ...flags });
            try {
              await syncRemoteTasks(s.user.id, get, set);
            } catch (err) {
              console.error('sync after auth change failed', err);
            }
          })();
        });
      }

      if (session?.user) {
        await syncRemoteTasks(session.user.id, get, set);
      } else {
        set({ tasks: [] });
      }
    } catch (err) {
      console.error('init failed', err);
    } finally {
      set({ ready: true });
    }
  },

  addTask: (input) => {
    const uid = get().user?.id;
    if (get().cloudEnabled && !uid) return;
    if (get().e2eeLocked) return;

    const now = Date.now();
    const task = createTask({ id: uuid(), ...input }, now);
    const next = [...get().tasks, task];
    set({ tasks: next });
    saveTasks(next, uid ?? null);
    if (uid) void upsertRemote(task, uid);
  },

  applyAction: (id, action) => {
    if (get().e2eeLocked) return;
    const now = Date.now();
    const cfg = get().config;
    let updated: Task | null = null;
    const next = get().tasks.map((t) => {
      if (t.id !== id) return t;
      updated = schedule(t, action, now, cfg);
      return updated;
    });
    set({ tasks: next });
    saveTasks(next, get().user?.id ?? null);
    const uid = get().user?.id;
    if (uid && updated) void upsertRemote(updated, uid);
  },

  reopenTask: (id) => {
    get().applyAction(id, { type: 'reopen' });
  },

  updateTaskNote: (id, note) => {
    if (get().e2eeLocked) return;
    const trimmed = note.trim();
    let updated: Task | null = null;
    const next = get().tasks.map((t) => {
      if (t.id !== id) return t;
      updated = {
        ...t,
        note: trimmed || undefined,
        updatedAt: Date.now(),
      };
      return updated;
    });
    set({ tasks: next });
    saveTasks(next, get().user?.id ?? null);
    const uid = get().user?.id;
    if (uid && updated) void upsertRemote(updated, uid);
  },

  updateTaskTitle: (id, title) => {
    if (get().e2eeLocked) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    let updated: Task | null = null;
    const next = get().tasks.map((t) => {
      if (t.id !== id) return t;
      updated = { ...t, title: trimmed, updatedAt: Date.now() };
      return updated;
    });
    set({ tasks: next });
    saveTasks(next, get().user?.id ?? null);
    const uid = get().user?.id;
    if (uid && updated) void upsertRemote(updated, uid);
  },

  syncWebhookContent: async () => {
    const uid = get().user?.id;
    if (!uid) return;
    for (const task of get().tasks) {
      await upsertRemote(task, uid);
    }
  },

  deleteTask: (id) => {
    if (get().e2eeLocked) return;
    const next = get().tasks.filter((t) => t.id !== id);
    set({ tasks: next });
    saveTasks(next, get().user?.id ?? null);
    if (get().user?.id) void deleteRemote(id);
  },

  setConfig: (patch) => {
    const config = { ...get().config, ...patch };
    set({ config });
    saveLocal(LS_CONFIG, config);
  },

  signInWithUsername: async (username, password) => {
    if (!supabase) return t('errCloudNotConfigured');
    if (!validateUsername(username)) return t('errInvalidUsername');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) return mapAuthError(error.message);
    if (!data.user) return t('errSignInFailed');

    const e2eeErr = await ensureE2EEWithPassword(data.user, username, password);
    if (e2eeErr) return e2eeErr;

    set({ user: data.user, e2eeEnabled: true, e2eeLocked: false });
    await syncRemoteTasks(data.user.id, get, set);
    void ensurePushSubscription(data.user.id);
    return null;
  },

  signUpWithUsername: async (username, password) => {
    if (!supabase) return t('errCloudNotConfigured');
    if (!validateUsername(username)) return t('errInvalidUsername');
    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password,
      options: { data: { username: username.trim() } },
    });
    if (error) return mapAuthError(error.message);
    if (!data.session || !data.user) {
      return t('errSignUpFailed');
    }

    const e2eeErr = await ensureE2EEWithPassword(data.user, username, password);
    if (e2eeErr) return e2eeErr;

    set({ user: data.user, e2eeEnabled: true, e2eeLocked: false });
    await syncRemoteTasks(data.user.id, get, set);
    void ensurePushSubscription(data.user.id);
    return null;
  },

  unlockVault: async (password) => {
    const user = get().user;
    if (!user) return t('errSignInFirst');
    const e2eeErr = await ensureE2EEWithPassword(
      user,
      (user.user_metadata?.username as string) ?? t('defaultUser'),
      password,
    );
    if (e2eeErr) return e2eeErr;
    set({ e2eeLocked: false, e2eeEnabled: true });
    await syncRemoteTasks(user.id, get, set);
    void ensurePushSubscription(user.id);
    return null;
  },

  enablePush: async () => {
    const uid = get().user?.id;
    if (!uid) return t('errSignInFirst');
    return subscribeToPush(uid);
  },

  disablePush: async () => {
    try {
      await unsubscribeFromPush();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : t('errDisablePushFailed');
    }
  },

  signOut: async () => {
    if (!supabase) return;
    const uid = get().user?.id;
    await supabase.auth.signOut();
    clearSessionTasks(set, uid);
    set({ user: null });
  },

  exportJson: () => JSON.stringify({ tasks: get().tasks, config: get().config }, null, 2),

  importJson: (json) => {
    try {
      const parsed = JSON.parse(json) as { tasks?: unknown; config?: BackoffConfig };
      const tasks = sanitizeTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
      const uid = get().user?.id;
      if (get().cloudEnabled && !uid) return;
      if (get().e2eeLocked) return;
      set({ tasks });
      saveTasks(tasks, uid ?? null);
      if (parsed.config) get().setConfig(parsed.config);
      if (uid) for (const t of tasks) void upsertRemote(t, uid);
    } catch {
      // ignore malformed import
    }
  },
}));
