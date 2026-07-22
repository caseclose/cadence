#!/usr/bin/env node
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Session } from '@supabase/supabase-js';
import { decryptTask, encryptTask, unlockDek, type E2EEMetadata } from './crypto.js';

type Config = { url: string; key: string; session: Session };
type Task = { id: string; title: string; note?: string; strategy: 'converging' | 'exponential'; etaMs: number; initialEtaMs: number; state: 'waiting'; attempts: number; nextFireAt: number; priority: number; createdAt: number; updatedAt: number };
const configPath = join(homedir(), '.config', 'cadence', 'config.json');
const [command, subcommand, ...args] = process.argv.slice(2);
const value = (name: string, fallback = '') => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] ?? fallback; };
const required = (name: string) => { const result = value(name); if (!result) throw new Error(`Missing ${name}`); return result; };
const usernameToEmail = (username: string) => `${username.trim()}@cadence.auth`;

async function load(): Promise<Config> { return JSON.parse(await readFile(configPath, 'utf8')) as Config; }
async function save(config: Config) { await mkdir(join(homedir(), '.config', 'cadence'), { recursive: true, mode: 0o700 }); await writeFile(configPath, JSON.stringify(config), { mode: 0o600 }); }
async function client() { const config = await load(); const db = createClient(config.url, config.key, { auth: { persistSession: false } }); await db.auth.setSession(config.session); return { db, config }; }
async function dek() {
  const { db } = await client();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error('Session is invalid. Run cadence login again.');
  const password = process.env.CADENCE_PASSWORD;
  if (!password) throw new Error('Set CADENCE_PASSWORD for this command; it is never saved.');
  return { db, user, dek: await unlockDek(user.user_metadata as E2EEMetadata, password) };
}

if (command === 'login') {
  const url = required('--url'); const key = required('--anon-key'); const username = required('--username'); const password = required('--password');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error || !data.session) throw error ?? new Error('No session returned');
  await save({ url, key, session: data.session });
  console.log('Logged in. Set CADENCE_PASSWORD only when adding or decrypting tasks.');
} else if (command === 'logout') {
  await rm(configPath, { force: true }); console.log('Logged out.');
} else if (command === 'task' && subcommand === 'list') {
  const { db, dek: key } = await dek();
  const { data, error } = await db.from('tasks').select('*').order('next_fire_at'); if (error) throw error;
  const tasks = await Promise.all((data ?? []).map(async (row) => row.enc ? decryptTask<Task>(key, row.enc) : row));
  console.log(JSON.stringify(tasks, null, 2));
} else if (command === 'task' && subcommand === 'add') {
  const { db, user, dek: key } = await dek();
  const title = required('--title'); const etaMs = Number(required('--eta-ms')); const strategy = value('--strategy', 'converging');
  if (!Number.isFinite(etaMs) || etaMs <= 0 || !['converging', 'exponential'].includes(strategy)) throw new Error('Use a positive --eta-ms and a valid --strategy.');
  const now = Date.now(); const id = crypto.randomUUID();
  const task: Task = { id, title, note: value('--note') || undefined, strategy: strategy as Task['strategy'], etaMs, initialEtaMs: etaMs, state: 'waiting', attempts: 0, nextFireAt: now + etaMs, priority: Number(value('--priority', '0')), createdAt: now, updatedAt: now };
  const enc = await encryptTask(key, task);
  const { error } = await db.from('tasks').insert({ id, user_id: user.id, title: '[e2ee]', note: null, strategy: 'converging', eta_ms: 0, initial_eta_ms: 0, state: task.state, attempts: 0, next_fire_at: task.nextFireAt, priority: 0, created_at: now, updated_at: now, enc });
  if (error) throw error; console.log(JSON.stringify({ id, nextFireAt: task.nextFireAt }));
} else {
  console.log('cadence login --url URL --anon-key KEY --username NAME --password PASSWORD\ncadence logout\ncadence task add --title TITLE --eta-ms MS [--note NOTE] [--strategy converging|exponential] [--priority N]\ncadence task list');
}
