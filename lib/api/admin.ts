import { Router, bad, notFound, str, num, numOrNull, J, P } from "../http";
import { all, get, run, uid, nowIso, audit } from "../db";
import { ApiError } from "../auth";

export function mountAdmin(r: Router) {
  // Statistiques agrégées uniquement : aucun accès aux journaux privés.
  r.admin.get("/admin/stats", () => ({
    users: get<any>("SELECT COUNT(*) c FROM users WHERE deleted_at IS NULL")?.c, exercises: get<any>("SELECT COUNT(*) c FROM exercises WHERE user_id IS NULL AND archived=0")?.c,
    foods: get<any>("SELECT COUNT(*) c FROM foods WHERE user_id IS NULL AND archived=0")?.c, reportsOpen: get<any>("SELECT COUNT(*) c FROM reports WHERE status='ouvert'")?.c,
    exercisesNeedingReview: get<any>("SELECT COUNT(*) c FROM exercises WHERE user_id IS NULL AND reviewed_at IS NULL AND archived=0")?.c,
    exercisesWithMediaMissingRights: get<any>("SELECT COUNT(*) c FROM exercises WHERE user_id IS NULL AND media_url IS NOT NULL AND (media_author IS NULL OR media_source IS NULL OR media_license IS NULL)")?.c,
  }));
  r.admin.get("/admin/exercises", () => ({ exercises: all<any>(`SELECT * FROM exercises e WHERE user_id IS NULL AND version=(SELECT MAX(version) FROM exercises x WHERE x.ex_key=e.ex_key AND x.user_id IS NULL) ORDER BY name`) }));
  // Version publique : les droits des médias sont obligatoires (EXO 01) ; une publication crée une nouvelle version.
  r.admin.put("/admin/exercises/:key", ({ user, params, body }) => {
    const cur = get<any>("SELECT * FROM exercises WHERE ex_key=? AND user_id IS NULL ORDER BY version DESC LIMIT 1", params[0]);
    if (!cur) throw notFound();
    const media = body.media_url ? { url: str(body.media_url, "Média", 500), author: str(body.media_author, "Auteur du média", 120), source: str(body.media_source, "Source du média", 200), license: str(body.media_license, "Licence du média", 120) } : null;
    if (media && !/^https?:\/\//.test(media.url)) throw bad("URL de média invalide.");
    const id = uid();
    run(`INSERT INTO exercises(id,ex_key,version,user_id,name,alias,movement,primary_muscles,secondary_muscles,place,equipment,level,metric,steps,mistakes,easier,alternative,pattern,media_url,media_author,media_source,media_license,status,reviewed_at)
      VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?)`, id, cur.ex_key, cur.version + 1, body.name ? str(body.name, "Nom", 100) : cur.name, cur.alias, cur.movement, cur.primary_muscles, cur.secondary_muscles, cur.place, cur.equipment, cur.level, cur.metric,
      body.steps !== undefined ? str(body.steps, "Étapes", 3000, false) : cur.steps, body.mistakes !== undefined ? str(body.mistakes, "Erreurs", 1000, false) : cur.mistakes, cur.easier, cur.alternative, cur.pattern,
      media?.url ?? cur.media_url, media?.author ?? cur.media_author, media?.source ?? cur.media_source, media?.license ?? cur.media_license, body.reviewed ? nowIso() : null);
    audit(null, user.id, "exercise_published", `${cur.ex_key}@${cur.version + 1}`);
    return { id, version: cur.version + 1 };
  });
  r.admin.get("/admin/reports", () => ({ reports: all("SELECT * FROM reports ORDER BY status, at DESC LIMIT 200") }));
  r.admin.put("/admin/reports/:id", ({ user, params, body }) => { run("UPDATE reports SET status=? WHERE id=?", body.status === "traite" ? "traite" : "ouvert", params[0]); audit(null, user.id, "report_updated", params[0]); });
  r.admin.get("/admin/users", () => ({ users: all("SELECT id,email,role,created_at,email_verified FROM users WHERE deleted_at IS NULL ORDER BY created_at") }));
  r.admin.get("/admin/audit", () => ({ events: all("SELECT id,actor,action,detail,at FROM audit ORDER BY at DESC LIMIT 200") }));
  // Accès exceptionnel de support : motif obligatoire, autorisation de l'utilisateur, durée limitée, trace. Ne donne accès qu'aux métadonnées techniques.
  r.admin.post("/admin/support", ({ user, body }) => {
    const target = get<any>("SELECT id FROM users WHERE email=? AND deleted_at IS NULL", str(body.email, "E-mail", 200).toLowerCase());
    if (!target) throw notFound("Compte introuvable.");
    const id = uid();
    run("INSERT INTO support_access(id,target_user,admin_id,reason,expires,authorized_by_user,at) VALUES(?,?,?,?,?,0,?)", id, target.id, user.id, str(body.reason, "Motif", 500), Date.now() + 3600e3, nowIso());
    audit(target.id, user.id, "support_requested", id);
    return { id, status: "en attente d'autorisation de l'utilisateur" };
  });
  r.admin.get("/admin/support/:id", ({ user, params }) => {
    const s = get<any>("SELECT * FROM support_access WHERE id=? AND admin_id=?", params[0], user.id);
    if (!s) throw notFound();
    if (!s.authorized_by_user) throw new ApiError(403, "L'utilisateur n'a pas autorisé cet accès.");
    if (s.expires < Date.now()) throw new ApiError(403, "Accès expiré.");
    audit(s.target_user, user.id, "support_viewed", s.id);
    const u = get<any>("SELECT id,email,created_at,tz,email_verified,ai_enabled FROM users WHERE id=?", s.target_user);
    return { account: u, counts: { meals: get<any>("SELECT COUNT(*) c FROM meals WHERE user_id=?", s.target_user)?.c, workouts: get<any>("SELECT COUNT(*) c FROM workouts WHERE user_id=?", s.target_user)?.c }, note: "Les contenus des journaux ne sont pas exposés." };
  });
  void J; void P; void num; void numOrNull;
}
