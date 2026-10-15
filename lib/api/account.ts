import crypto from "node:crypto";
import { Router, bad, notFound, str, num, J, P, todayIn } from "../http";
import { all, get, run, tx, uid, nowIso, audit } from "../db";
import { ApiError, register, login, startSession, endSession, revokeAllSessions, hashPassword, verifyPassword, validatePassword, currentUser } from "../auth";

const csvCell = (v: unknown): string => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // protection contre l'exécution de formules (EXP 01)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "﻿";
  const cols = Object.keys(rows[0]);
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(";"))].join("\r\n"); // UTF-8 avec BOM, séparateur « ; »
};

/** Export strictement limité au compte connecté. Les catalogues publics ne sont pas redistribués. */
export function buildExport(userId: string) {
  const q = (t: string, extra = "") => all<any>(`SELECT * FROM ${t} WHERE user_id=? ${extra}`, userId);
  const u = get<any>("SELECT id,email,name,tz,created_at,equipment,ai_enabled,memory_enabled FROM users WHERE id=?", userId);
  return {
    meta: { exported_at: nowIso(), units: { weight: "kg", length: "cm", energy: "kcal", distance: "km", duration: "min (sauf mention s)", load: "kg" }, dates: "dates locales AAAA-MM-JJ ; horodatages techniques en UTC" },
    account: u, lifestyle: q("lifestyle_versions").map((x) => ({ ...x, data: P(x.data, {}) })), goals: q("goals"), weights: q("weights"), measurements: q("measurements"),
    meals: q("meals"), day_status: q("day_status"), foods_private: q("foods"), recipes: q("recipes").map((x) => ({ ...x, ingredients: P(x.ingredients, []) })),
    exercises_private: q("exercises"), exercise_media: q("exercise_user_media"), routines: q("routines").map((x) => ({ ...x, items: P(x.items, []) })), planned: q("planned"),
    workouts: q("workouts").map((x) => ({ ...x, snapshot: P(x.snapshot, null) })), sets: q("sets"), activities: q("activities"), notes: q("notes"),
    memory: q("memory"), conversations: q("conversations"), proposals: q("proposals").map((x) => ({ ...x, payload: P(x.payload, null), result: P(x.result, null) })), consents: q("consents"),
  };
}

export function mountAccount(r: Router) {
  r.post("/auth/register", async ({ body }) => {
    const u = register(body.email, body.password, body.name ?? null, body.tz ?? "Europe/Paris", !!body.adult);
    await startSession(u.id);
    return { user: { id: u.id, email: u.email, role: u.role } };
  }, "none");
  r.post("/auth/login", async ({ body }) => {
    const u = login(body.email, body.password);
    await startSession(u.id);
    audit(u.id, u.id, "login");
    return { user: { id: u.id, email: u.email, role: u.role } };
  }, "none");
  r.post("/auth/logout", async () => { await endSession(); }, "none");
  // Réinitialisation : jeton temporaire. Sans service de courriel configuré, le lien n'est PAS affiché au client (évite la prise de contrôle) ; il est journalisé côté serveur.
  r.post("/auth/reset-request", ({ body }) => {
    const u = get<any>("SELECT id FROM users WHERE email=? AND deleted_at IS NULL", String(body.email ?? "").trim().toLowerCase());
    if (u) {
      const token = crypto.randomBytes(32).toString("base64url");
      run("INSERT INTO reset_tokens(token,user_id,expires) VALUES(?,?,?)", crypto.createHash("sha256").update(token).digest("hex"), u.id, Date.now() + 3600e3);
      console.log(`[reset] jeton généré pour un compte (hôte de messagerie non configuré) : /reset?token=${token}`);
    }
    return { ok: true, message: "Si un compte existe, un lien de réinitialisation a été préparé." };
  }, "none");
  r.post("/auth/reset", ({ body }) => {
    const h = crypto.createHash("sha256").update(String(body.token ?? "")).digest("hex");
    const t = get<any>("SELECT * FROM reset_tokens WHERE token=? AND expires>?", h, Date.now());
    if (!t) throw bad("Lien invalide ou expiré.");
    validatePassword(body.password);
    tx(() => { run("UPDATE users SET pass_hash=?, failed_logins=0, locked_until=0 WHERE id=?", hashPassword(body.password), t.user_id); run("DELETE FROM reset_tokens WHERE user_id=?", t.user_id); revokeAllSessions(t.user_id); });
    audit(t.user_id, t.user_id, "password_reset");
  }, "none");

  r.get("/me", async () => {
    const u = await currentUser();
    if (!u) return { user: null };
    return { user: { id: u.id, email: u.email, role: u.role, name: u.name, tz: u.tz, ai_enabled: !!u.ai_enabled, memory_enabled: !!u.memory_enabled, today: todayIn(u.tz) } };
  }, "none");
  r.put("/me", ({ user, body }) => {
    let tz = user.tz;
    if (body.tz) { try { new Intl.DateTimeFormat("fr-FR", { timeZone: body.tz }); tz = body.tz; } catch { throw bad("Fuseau horaire invalide."); } }
    run("UPDATE users SET name=?, tz=? WHERE id=?", body.name !== undefined ? str(body.name, "Nom", 80, false) || null : user.name, tz, user.id);
  });
  r.post("/me/password", ({ user, body }) => {
    const row = get<any>("SELECT pass_hash FROM users WHERE id=?", user.id);
    if (!verifyPassword(String(body.current ?? ""), row.pass_hash)) throw new ApiError(401, "Mot de passe actuel incorrect.");
    validatePassword(body.password);
    run("UPDATE users SET pass_hash=? WHERE id=?", hashPassword(body.password), user.id);
    revokeAllSessions(user.id); // révocation des sessions, y compris sur navigateurs partagés
    audit(user.id, user.id, "password_changed");
  });
  r.post("/me/sessions/revoke", ({ user }) => { revokeAllSessions(user.id); });

  // Suppression : accès bloqué immédiatement, données privées purgées dans la transaction ; seul un événement d'audit sans contenu est conservé.
  r.post("/me/delete", async ({ user, body }) => {
    const row = get<any>("SELECT pass_hash FROM users WHERE id=?", user.id);
    if (!verifyPassword(String(body.password ?? ""), row.pass_hash)) throw new ApiError(401, "Mot de passe incorrect.");
    tx(() => {
      run("DELETE FROM users WHERE id=?", user.id); // ON DELETE CASCADE sur toutes les tables privées
      run("DELETE FROM agent_usage WHERE user_id=?", user.id);
      run("DELETE FROM reports WHERE user_id=?", user.id);
      run("DELETE FROM support_access WHERE target_user=?", user.id);
      audit(user.id, user.id, "account_deleted", "purge effectuée"); // rejouable après restauration de sauvegarde
    });
    await endSession();
  });

  // --- export ---
  r.post("/exports", ({ user, body }) => {
    const data = buildExport(user.id);
    const format = body.format === "csv" ? "csv" : "json";
    let payload: string;
    if (format === "json") payload = JSON.stringify(data, null, 2);
    else {
      const domain = str(body.domain, "Domaine", 40);
      const d = (data as any)[domain];
      if (!Array.isArray(d)) throw bad("Domaine inconnu.");
      payload = toCsv(d.map((row: any) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v]))));
    }
    const token = crypto.randomBytes(24).toString("base64url");
    run("INSERT INTO exports(token,user_id,expires,payload) VALUES(?,?,?,?)", token, user.id, Date.now() + 24 * 3600e3, JSON.stringify({ format, payload, domain: body.domain ?? null }));
    audit(user.id, user.id, "export_created", format);
    return { url: `/api/exports/${token}`, expires_in_hours: 24 };
  });
  // Lien authentifié, propriétaire uniquement, supprimé après téléchargement.
  r.get("/exports/:token", ({ user, params }) => {
    const e = get<any>("SELECT * FROM exports WHERE token=? AND user_id=? AND expires>?", params[0], user.id, Date.now());
    if (!e) throw notFound("Lien expiré ou inconnu.");
    run("DELETE FROM exports WHERE token=?", params[0]);
    const x = JSON.parse(e.payload);
    return new Response(x.payload, { headers: { "content-type": x.format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8", "content-disposition": `attachment; filename="terminator-${x.domain ?? "export"}-${nowIso().slice(0, 10)}.${x.format}"`, "cache-control": "no-store" } });
  });

  // --- signalements ---
  r.post("/reports", ({ user, body }) => {
    run("INSERT INTO reports(id,user_id,kind,ref_id,message,at) VALUES(?,?,?,?,?,?)", uid(), user.id, ["exercise", "food", "other"].includes(body.kind) ? body.kind : "other", body.ref_id ? String(body.ref_id).slice(0, 80) : null, str(body.message, "Message", 1000), nowIso());
  });
  // --- accès exceptionnel de support : autorisation de l'utilisateur ---
  r.get("/me/support", ({ user }) => ({ requests: all("SELECT id,reason,expires,authorized_by_user,at FROM support_access WHERE target_user=? ORDER BY at DESC LIMIT 20", user.id) }));
  r.post("/me/support/:id/authorize", ({ user, params, body }) => {
    const s = get<any>("SELECT * FROM support_access WHERE id=? AND target_user=?", params[0], user.id);
    if (!s) throw notFound();
    const minutes = Math.min(Math.max(num(body.minutes ?? 30, "Durée", { min: 5 }), 5), 120);
    run("UPDATE support_access SET authorized_by_user=1, expires=? WHERE id=?", Date.now() + minutes * 60e3, s.id);
    audit(user.id, user.id, "support_authorized", s.id);
  });
  void J;
}
