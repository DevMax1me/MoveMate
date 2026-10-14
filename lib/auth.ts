import crypto from "node:crypto";
import { cookies } from "next/headers";
import { all, get, run, uid, nowIso, audit } from "./db";

export type User = { id: string; email: string; role: "user" | "admin"; name: string | null; tz: string; ai_enabled: number; memory_enabled: number; equipment: string; adult_confirmed: number };
export const COOKIE = "tm_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [, s, h] = stored.split("$");
  if (!s || !h) return false;
  const calc = crypto.scryptSync(pw, Buffer.from(s, "base64"), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(calc, Buffer.from(h, "base64"));
}

export function validatePassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < 10) throw new ApiError(400, "Le mot de passe doit contenir au moins 10 caractères.");
  if (pw.length > 200) throw new ApiError(400, "Mot de passe trop long.");
  return pw;
}

export function register(email: string, password: string, name: string | null, tz: string, adult: boolean): User {
  email = String(email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, "Adresse électronique invalide.");
  validatePassword(password);
  if (!adult) throw new ApiError(400, "La V1 est réservée aux adultes : confirmez avoir 18 ans ou plus.");
  if (get("SELECT id FROM users WHERE email=?", email)) throw new ApiError(409, "Un compte existe déjà avec cette adresse.");
  const first = (get<{ c: number }>("SELECT COUNT(*) c FROM users")?.c ?? 0) === 0;
  const id = uid();
  // Le premier compte devient administrateur (amorçage). Les suivants sont des utilisateurs.
  run("INSERT INTO users(id,email,pass_hash,role,name,tz,adult_confirmed,email_verified,created_at) VALUES(?,?,?,?,?,?,1,0,?)",
    id, email, hashPassword(password), first ? "admin" : "user", name?.trim() || null, tz || "Europe/Paris", nowIso());
  run("INSERT INTO consents(id,user_id,purpose,version,granted,at) VALUES(?,?,?,?,1,?)", uid(), id, "journal_suivi", "1.0", nowIso());
  audit(id, id, "register");
  return get<User>("SELECT * FROM users WHERE id=?", id)!;
}

export function login(email: string, password: string): User {
  const u = get<User & { pass_hash: string; failed_logins: number; locked_until: number; deleted_at: string | null }>("SELECT * FROM users WHERE email=?", String(email ?? "").trim().toLowerCase());
  const generic = new ApiError(401, "Adresse ou mot de passe incorrect.");
  if (!u || u.deleted_at) { crypto.scryptSync("x", "y", 64); throw generic; }
  if (u.locked_until > Date.now()) throw new ApiError(429, "Trop de tentatives. Réessayez dans quelques minutes.");
  if (!verifyPassword(String(password ?? ""), u.pass_hash)) {
    const n = u.failed_logins + 1;
    run("UPDATE users SET failed_logins=?, locked_until=? WHERE id=?", n >= LOCK_AFTER ? 0 : n, n >= LOCK_AFTER ? Date.now() + LOCK_MS : 0, u.id);
    throw generic;
  }
  run("UPDATE users SET failed_logins=0, locked_until=0 WHERE id=?", u.id);
  return u;
}

export async function startSession(userId: string) {
  const id = crypto.randomBytes(32).toString("base64url");
  run("INSERT INTO sessions(id,user_id,expires) VALUES(?,?,?)", id, userId, Date.now() + SESSION_MS);
  (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MS / 1000 });
}
export async function endSession() {
  const c = await cookies();
  const id = c.get(COOKIE)?.value;
  if (id) run("DELETE FROM sessions WHERE id=?", id);
  c.delete(COOKIE);
}
export function revokeAllSessions(userId: string) { run("DELETE FROM sessions WHERE user_id=?", userId); }

/** Le propriétaire est toujours déduit de la session serveur (IA 01), jamais d'un identifiant client. */
export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const s = get<{ user_id: string; expires: number }>("SELECT user_id, expires FROM sessions WHERE id=?", id);
  if (!s) return null;
  if (s.expires < Date.now()) { run("DELETE FROM sessions WHERE id=?", id); return null; }
  return get<User>("SELECT id,email,role,name,tz,ai_enabled,memory_enabled,equipment,adult_confirmed FROM users WHERE id=? AND deleted_at IS NULL", s.user_id) ?? null;
}
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new ApiError(401, "Connexion requise.");
  return u;
}
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") throw new ApiError(403, "Réservé à l'administration.");
  return u;
}

export function purgeExpired() {
  run("DELETE FROM sessions WHERE expires<?", Date.now());
  run("DELETE FROM exports WHERE expires<?", Date.now());
  run("DELETE FROM reset_tokens WHERE expires<?", Date.now());
  void all;
}
