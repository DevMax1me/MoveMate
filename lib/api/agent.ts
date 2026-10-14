import { Router, bad, notFound, str, J, P, todayIn } from "../http";
import { all, get, run, uid, nowIso, audit } from "../db";
import { ApiError } from "../auth";
import { route, proposeRecipe, proposeRoutine, proposeWeekPriorities, validateRecipeDraft, validateRoutineDraft, recordProposal, RULES_VERSION, weekReport, searchKnowledge } from "../agent";
import { createRecipe } from "./nutrition";
import { getProvider } from "../provider";

const QUOTA = () => Number(process.env.AGENT_DAILY_QUOTA) || 30;
const RETENTION_DAYS = 90;

function useQuota(userId: string) {
  const day = nowIso().slice(0, 10);
  const u = get<any>("SELECT calls FROM agent_usage WHERE user_id=? AND day=?", userId, day);
  if ((u?.calls ?? 0) >= QUOTA()) throw new ApiError(429, "Quota quotidien de l'agent atteint. Vos journaux et routines restent utilisables ; réessayez demain.");
  run("INSERT INTO agent_usage(user_id,day,calls) VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET calls=calls+1", userId, day);
}
const needAi = (u: { ai_enabled: number }) => { if (!u.ai_enabled) throw new ApiError(403, "L'agent est désactivé. Activez-le dans « Mon agent » ; vos journaux restent utilisables sans lui."); };
const out = (p: any) => ({ ...p, payload: P(p.payload, {}), uses: P(p.uses, []), result: P(p.result, null) });

export function applyProposal(user: any, p: any) {
  const d = P<any>(p.payload, {});
  if (p.kind === "recipe_draft") {
    const errs = validateRecipeDraft(user.id, d);
    if (errs.length) throw new ApiError(422, "La proposition ne respecte plus vos contraintes.", { details: errs });
    const r = createRecipe(user, { title: d.title, servings: d.servings, time_min: d.time_min, tags: d.tags, steps: d.steps, ingredients: d.ingredients.map((i: any) => ({ key: i.key, qty: i.qty, unit: i.unit })) });
    return { recipe_key: r.recipe_key, kind: "recipe" };
  }
  if (p.kind === "routine_draft") {
    const errs = validateRoutineDraft(user.id, d);
    if (errs.length) throw new ApiError(422, "La proposition ne respecte plus vos contraintes.", { details: errs });
    const id = uid(), key = "ro-" + uid();
    run("INSERT INTO routines(id,routine_key,version,user_id,name,place,items,created_at) VALUES(?,?,1,?,?,?,?,?)", id, key, user.id, String(d.name).slice(0, 100), d.place === "gym" ? "gym" : "home",
      J(d.items.map((i: any) => ({ slug: i.slug, sets: Number(i.sets), warmup_sets: 0, reps: String(i.reps ?? ""), load: null, duration_s: null, distance_km: null, rest: Number(i.rest) || 60, intensity: "", notes: "" }))), nowIso());
    return { routine_key: key, kind: "routine" };
  }
  if (p.kind === "memory_fact") {
    if (!user.memory_enabled) throw new ApiError(403, "La mémorisation est désactivée.");
    const id = uid();
    run("INSERT INTO memory(id,user_id,fact,source,created_at) VALUES(?,?,?,?,?)", id, user.id, String(d.fact).slice(0, 300), String(d.source ?? "Confirmé par vous").slice(0, 120), nowIso());
    return { memory_id: id, kind: "memory" };
  }
  if (p.kind === "week_priorities") return { kind: "priorities" }; // enregistrées comme acceptées ; aucune écriture au journal
  throw bad("Type de proposition inconnu.");
}

export function mountAgent(r: Router) {
  r.get("/agent/status", ({ user }) => {
    const day = nowIso().slice(0, 10);
    return { ai_enabled: !!user.ai_enabled, memory_enabled: !!user.memory_enabled, quota: QUOTA(), used: get<any>("SELECT calls FROM agent_usage WHERE user_id=? AND day=?", user.id, day)?.calls ?? 0,
      provider: getProvider()?.name ?? null, rulesVersion: RULES_VERSION, retentionDays: RETENTION_DAYS,
      transmitted: getProvider() ? "Le texte de la réponse déjà calculée (chiffres issus de calculs déterministes). Ni votre historique complet, ni votre identité." : "Rien : l'agent fonctionne en local, en mode règles." };
  });
  r.post("/me/ai", ({ user, body }) => {
    const enabled = body.enabled ? 1 : 0;
    run("UPDATE users SET ai_enabled=? WHERE id=?", enabled, user.id);
    run("INSERT INTO consents(id,user_id,purpose,version,granted,at) VALUES(?,?,?,?,?,?)", uid(), user.id, "agent_ia", "1.0", enabled, nowIso());
    if (!enabled && body.purge) { run("DELETE FROM memory WHERE user_id=?", user.id); run("DELETE FROM conversations WHERE user_id=?", user.id); }
    audit(user.id, user.id, enabled ? "ai_enabled" : "ai_disabled");
  });
  r.post("/me/memory", ({ user, body }) => { run("UPDATE users SET memory_enabled=? WHERE id=?", body.enabled ? 1 : 0, user.id); });

  r.get("/agent/conversation", ({ user }) => {
    run("DELETE FROM conversations WHERE user_id=? AND created_at<?", user.id, new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString()); // rétention 90 j
    return { messages: all<any>("SELECT * FROM conversations WHERE user_id=? ORDER BY created_at, rowid", user.id).map((m) => ({ ...m, citations: P(m.citations, null) })) };
  });
  r.del("/agent/conversation", ({ user }) => { run("DELETE FROM conversations WHERE user_id=?", user.id); });
  r.post("/agent/chat", async ({ user, body }) => {
    needAi(user);
    const message = str(body.message, "Message", 2000);
    useQuota(user.id);
    run("INSERT INTO conversations(id,user_id,role,content,created_at) VALUES(?,?,?,?,?)", uid(), user.id, "user", message, nowIso());
    const reply = route(user.id, user.tz, message, !!user.memory_enabled);
    let text = reply.text, notice: string | null = null;
    // Les propositions sont revalidées avant affichage (IA 02) ; une violation bloque l'affichage.
    let proposalId: string | null = null;
    if (reply.proposalKind) {
      const errs = reply.proposalKind === "recipe_draft" ? validateRecipeDraft(user.id, reply.draft) : reply.proposalKind === "routine_draft" ? validateRoutineDraft(user.id, reply.draft) : [];
      if (errs.length) { text = "Je n'ai pas pu produire de proposition qui respecte vos contraintes. Souhaitez-vous assouplir un critère ?"; }
      else proposalId = recordProposal(user.id, reply.proposalKind, reply.draft, reply.rationale ?? "", reply.uses ?? []);
    }
    if (!reply.refused && !reply.proposalKind) {
      const prov = getProvider();
      if (prov && text.length > 40) { const t = await prov.rephrase(text); if (t) text = t; else notice = "Reformulation indisponible : réponse en mode règles."; }
    }
    run("INSERT INTO conversations(id,user_id,role,content,citations,created_at) VALUES(?,?,?,?,?,?)", uid(), user.id, "agent", text, J(reply.citations ?? (reply.uses ? { uses: reply.uses } : null)), nowIso());
    return { reply: text, uses: reply.uses ?? [], citations: reply.citations ?? [], proposal: proposalId ? out(get<any>("SELECT * FROM proposals WHERE id=?", proposalId)) : null, refused: !!reply.refused, notice };
  });
  // Génération directe (boutons de l'interface) : mêmes outils, même quota.
  r.post("/agent/propose", ({ user, body }) => {
    needAi(user);
    useQuota(user.id);
    let g: any, kind: any;
    if (body.kind === "recipe") { g = proposeRecipe(user.id, { query: body.query }); kind = "recipe_draft"; }
    else if (body.kind === "routine") { g = proposeRoutine(user.id, { minutes: body.minutes ? Number(body.minutes) : undefined, place: body.place === "gym" ? "gym" : body.place === "home" ? "home" : undefined }); kind = "routine_draft"; }
    else if (body.kind === "priorities") { g = proposeWeekPriorities(user.id, user.tz); kind = "week_priorities"; }
    else throw bad("Type inconnu.");
    if (!g.ok) return { conflict: g.conflict };
    const errs = kind === "recipe_draft" ? validateRecipeDraft(user.id, g.draft) : kind === "routine_draft" ? validateRoutineDraft(user.id, g.draft) : [];
    if (errs.length) return { conflict: "La proposition générée ne respecte pas vos contraintes ; elle est bloquée.", details: errs };
    const id = recordProposal(user.id, kind, g.draft, g.rationale, g.uses);
    return { proposal: out(get<any>("SELECT * FROM proposals WHERE id=?", id)) };
  });
  r.get("/agent/report", ({ user }) => { needAi(user); const w = weekReport(user.id, user.tz); return { text: w.text, uses: w.uses }; });
  r.get("/agent/knowledge", ({ user, query }) => ({ hits: searchKnowledge(user.id, query.get("q") ?? "") }));

  r.get("/agent/proposals", ({ user, query }) => {
    const st = query.get("status");
    return { proposals: all<any>(`SELECT * FROM proposals WHERE user_id=? ${st ? "AND status=?" : ""} ORDER BY created_at DESC LIMIT 50`, ...(st ? [user.id, st] : [user.id])).map(out) };
  });
  // Acceptation : le serveur revérifie propriétaire et contraintes ; idempotente (T30 : pas de doublon).
  r.post("/agent/proposals/:id/accept", ({ user, params }) => {
    const p = get<any>("SELECT * FROM proposals WHERE id=? AND user_id=?", params[0], user.id);
    if (!p) throw notFound();
    if (p.status === "accepted") return { proposal: out(p), replay: true };
    if (p.status !== "pending") throw bad("Cette proposition n'est plus en attente.");
    const result = applyProposal(user, p);
    run("UPDATE proposals SET status='accepted', result=?, decided_at=? WHERE id=?", J(result), nowIso(), p.id);
    audit(user.id, user.id, "proposal_accepted", `${p.kind}:${p.id}`);
    return { proposal: out(get<any>("SELECT * FROM proposals WHERE id=?", p.id)), replay: false };
  });
  r.post("/agent/proposals/:id/reject", ({ user, params, body }) => {
    const p = get<any>("SELECT * FROM proposals WHERE id=? AND user_id=?", params[0], user.id);
    if (!p) throw notFound();
    if (p.status !== "pending") return { ok: true };
    run("UPDATE proposals SET status='rejected', decided_at=? WHERE id=?", nowIso(), p.id);
    // Le refus ne modifie rien ; il n'est mémorisé comme préférence que si l'utilisateur le demande (T29).
    if (body.remember && user.memory_enabled) run("INSERT INTO memory(id,user_id,fact,source,created_at) VALUES(?,?,?,?,?)", uid(), user.id, `N'a pas souhaité la proposition « ${String(P<any>(p.payload, {}).title ?? P<any>(p.payload, {}).name ?? p.kind).slice(0, 100)} »`, "Refus confirmé par vous", nowIso());
  });
  r.post("/agent/proposals/:id/undo", ({ user, params }) => {
    const p = get<any>("SELECT * FROM proposals WHERE id=? AND user_id=?", params[0], user.id);
    if (!p || p.status !== "accepted") throw notFound();
    const res = P<any>(p.result, {});
    if (res.recipe_key) run("UPDATE recipes SET archived=1 WHERE recipe_key=? AND user_id=?", res.recipe_key, user.id);
    else if (res.routine_key) run("UPDATE routines SET archived=1 WHERE routine_key=? AND user_id=?", res.routine_key, user.id);
    else if (res.memory_id) run("DELETE FROM memory WHERE id=? AND user_id=?", res.memory_id, user.id);
    else throw bad("Action non annulable.");
    run("UPDATE proposals SET status='undone' WHERE id=?", p.id);
    audit(user.id, user.id, "proposal_undone", p.id);
  });

  // --- mémoire consultable, corrigeable, effaçable (AGT 04) ---
  r.get("/agent/memory", ({ user }) => ({ facts: all("SELECT * FROM memory WHERE user_id=? AND active=1 ORDER BY created_at DESC", user.id), enabled: !!user.memory_enabled }));
  r.put("/agent/memory/:id", ({ user, params, body }) => { run("UPDATE memory SET fact=?, source=? WHERE id=? AND user_id=?", str(body.fact, "Fait", 300), "Corrigé par vous", params[0], user.id); });
  r.del("/agent/memory/:id", ({ user, params }) => { run("DELETE FROM memory WHERE id=? AND user_id=?", params[0], user.id); });
  r.post("/agent/memory", ({ user, body }) => {
    const id = uid();
    run("INSERT INTO memory(id,user_id,fact,source,created_at) VALUES(?,?,?,?,?)", id, user.id, str(body.fact, "Fait", 300), "Saisi par vous", nowIso());
    return { id };
  });
  r.del("/agent/memory", ({ user }) => { run("DELETE FROM memory WHERE user_id=?", user.id); });
  void todayIn;
}
