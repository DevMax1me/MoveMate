import type { DatabaseSync as DB } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { seedCatalog } from "./seed";

// getBuiltinModule : évite que les bundlers (Next, Vite) ne réécrivent le préfixe node:
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = DB;
type G = typeof globalThis & { __db?: DatabaseSync };
const g = globalThis as G;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
  name TEXT, tz TEXT NOT NULL DEFAULT 'Europe/Paris', ai_enabled INTEGER NOT NULL DEFAULT 0, memory_enabled INTEGER NOT NULL DEFAULT 1,
  equipment TEXT NOT NULL DEFAULT '[]', email_verified INTEGER NOT NULL DEFAULT 0, failed_logins INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
  adult_confirmed INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lifestyle_versions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, effective_from TEXT NOT NULL, origin TEXT NOT NULL DEFAULT 'declared');
CREATE TABLE IF NOT EXISTS goals(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, phase TEXT NOT NULL, kcal REAL, protein REAL, carbs REAL, fat REAL,
  weight_target REAL, start_weight REAL, start_date TEXT NOT NULL, end_date TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS foods(id TEXT PRIMARY KEY, food_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, brand TEXT, basis TEXT NOT NULL, portion_g REAL, portion_ml REAL, portion_label TEXT, density REAL,
  kcal REAL, kj REAL, protein REAL, carbs REAL, fat REAL, fiber REAL, source TEXT NOT NULL, license TEXT, archived INTEGER NOT NULL DEFAULT 0, favorite_of TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS foods_key ON foods(food_key, version);
CREATE TABLE IF NOT EXISTS food_prefs(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, food_key TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, last_used TEXT, PRIMARY KEY(user_id, food_key));
CREATE TABLE IF NOT EXISTS recipes(id TEXT PRIMARY KEY, recipe_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, servings REAL NOT NULL, final_weight REAL, time_min INTEGER, tags TEXT NOT NULL DEFAULT '[]', steps TEXT, ingredients TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meals(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, category TEXT NOT NULL,
  kind TEXT NOT NULL, ref_id TEXT NOT NULL, label TEXT NOT NULL, qty REAL NOT NULL, unit TEXT NOT NULL, note TEXT,
  kcal REAL, protein REAL, carbs REAL, fat REAL, fiber REAL, incomplete INTEGER NOT NULL DEFAULT 0, estimated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, recalculated_at TEXT);
CREATE INDEX IF NOT EXISTS meals_day ON meals(user_id, date);
CREATE TABLE IF NOT EXISTS meal_templates(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT NOT NULL, items TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS day_status(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, closed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id, date));
CREATE TABLE IF NOT EXISTS weights(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, time TEXT, kg REAL NOT NULL, note TEXT,
  is_ref INTEGER NOT NULL DEFAULT 0, context TEXT, source TEXT, body_fat REAL);
CREATE INDEX IF NOT EXISTS weights_day ON weights(user_id, date);
CREATE TABLE IF NOT EXISTS measurements(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, name TEXT NOT NULL, cm REAL NOT NULL);
CREATE TABLE IF NOT EXISTS exercises(id TEXT PRIMARY KEY, ex_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, alias TEXT, movement TEXT NOT NULL, primary_muscles TEXT NOT NULL, secondary_muscles TEXT NOT NULL DEFAULT '[]', place TEXT NOT NULL,
  equipment TEXT NOT NULL DEFAULT '[]', level TEXT NOT NULL, metric TEXT NOT NULL, steps TEXT, mistakes TEXT, easier TEXT, alternative TEXT,
  media_url TEXT, media_author TEXT, media_source TEXT, media_license TEXT, status TEXT NOT NULL DEFAULT 'published', reviewed_at TEXT, archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS routines(id TEXT PRIMARY KEY, routine_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, place TEXT NOT NULL, items TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS planned(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, routine_key TEXT NOT NULL, date TEXT NOT NULL,
  series_id TEXT, weekday INTEGER, status TEXT NOT NULL DEFAULT 'prevu', workout_id TEXT);
CREATE TABLE IF NOT EXISTS workouts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, state TEXT NOT NULL,
  place TEXT, snapshot TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, date TEXT NOT NULL, planned_id TEXT, idem TEXT, rest_until INTEGER, updated_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS workouts_idem ON workouts(user_id, idem) WHERE idem IS NOT NULL;
CREATE TABLE IF NOT EXISTS sets(id TEXT PRIMARY KEY, workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL, exercise_name TEXT NOT NULL, equipment_ctx TEXT, idx INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'work', reps INTEGER, load REAL, load_conv TEXT,
  secs INTEGER, distance REAL, rpe REAL, rir INTEGER, side TEXT, bodyweight INTEGER NOT NULL DEFAULT 0, assisted INTEGER NOT NULL DEFAULT 0, confirmed_default INTEGER NOT NULL DEFAULT 0,
  idem TEXT, created_at TEXT NOT NULL, updated_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS sets_idem ON sets(user_id, idem) WHERE idem IS NOT NULL;
CREATE TABLE IF NOT EXISTS activities(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, date TEXT NOT NULL, duration_min REAL,
  distance_km REAL, steps INTEGER, rpe REAL, note TEXT, workout_id TEXT, energy_kcal REAL, energy_source TEXT);
CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY, note_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, content TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', type TEXT NOT NULL DEFAULT 'observation', topic TEXT NOT NULL DEFAULT 'general',
  source TEXT, source_date TEXT, status TEXT NOT NULL DEFAULT 'a_verifier', favorite INTEGER NOT NULL DEFAULT 0, link_kind TEXT, link_id TEXT,
  to_review INTEGER NOT NULL DEFAULT 0, added_at TEXT NOT NULL, reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS memory(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, fact TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, citations TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, payload TEXT NOT NULL, rationale TEXT NOT NULL,
  uses TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending', result TEXT, created_at TEXT NOT NULL, decided_at TEXT, rules_version TEXT);
CREATE TABLE IF NOT EXISTS agent_usage(user_id TEXT NOT NULL, day TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id, day));
CREATE TABLE IF NOT EXISTS consents(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, version TEXT NOT NULL, granted INTEGER NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, user_id TEXT, actor TEXT, action TEXT NOT NULL, detail TEXT, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, user_id TEXT, kind TEXT NOT NULL, ref_id TEXT, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ouvert', at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS support_access(id TEXT PRIMARY KEY, target_user TEXT NOT NULL, admin_id TEXT NOT NULL, reason TEXT NOT NULL, expires INTEGER NOT NULL, authorized_by_user INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS exports(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reset_tokens(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
`;

export function openDb(file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "terminator.db")): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  db.exec(SCHEMA);
  seedCatalog(db);
  return db;
}

export function db(): DatabaseSync {
  if (!g.__db) g.__db = openDb();
  return g.__db;
}

export const uid = () => crypto.randomBytes(12).toString("base64url");
export const nowIso = () => new Date().toISOString();

type Row = Record<string, unknown>;
export function all<T = Row>(sql: string, ...p: unknown[]): T[] { return db().prepare(sql).all(...(p as never[])) as T[]; }
export function get<T = Row>(sql: string, ...p: unknown[]): T | undefined { return db().prepare(sql).get(...(p as never[])) as T | undefined; }
export function run(sql: string, ...p: unknown[]) { return db().prepare(sql).run(...(p as never[])); }
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try { const r = fn(); d.exec("COMMIT"); return r; } catch (e) { d.exec("ROLLBACK"); throw e; }
}
export function audit(userId: string | null, actor: string | null, action: string, detail?: string) {
  run("INSERT INTO audit(id,user_id,actor,action,detail,at) VALUES(?,?,?,?,?,?)", uid(), userId, actor, action, detail ?? null, nowIso());
}
