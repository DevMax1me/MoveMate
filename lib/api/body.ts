import { Router, bad, notFound, str, num, numOrNull, dateStr, J, P, todayIn } from "../http";
import { all, get, run, tx, uid, nowIso } from "../db";
import { movingAverage7, weeklyVariation, goalProgress, addDays, type WeightPoint } from "../calc";
import { EQUIPMENT } from "../equipment";

export function refWeights(userId: string, from?: string, to?: string): (WeightPoint & { id: string; n: number })[] {
  const rows = all<any>(`SELECT id,date,kg,is_ref FROM weights WHERE user_id=? ${from ? "AND date>=?" : ""} ${to ? "AND date<=?" : ""} ORDER BY date, time, id`, ...[userId, from, to].filter((x) => x !== undefined));
  const byDay = new Map<string, any[]>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  return [...byDay.entries()].map(([date, rs]) => {
    const ref = rs.find((x) => x.is_ref) ?? rs[0]; // une pesée de référence par jour
    return { id: ref.id, date, kg: ref.kg, n: rs.length };
  });
}

export function weightSummary(userId: string, date: string) {
  const pts = refWeights(userId, addDays(date, -20), date);
  const ma = movingAverage7(pts, date);
  const wv = weeklyVariation(pts, date);
  const goal = get<any>("SELECT * FROM goals WHERE user_id=? AND weight_target IS NOT NULL AND start_date<=? ORDER BY start_date DESC LIMIT 1", userId, date);
  const last = pts[pts.length - 1];
  let progress = null as null | { pct: number; bar: number; gap: number; asOf: string; target: number; start: number };
  if (goal && last && goal.start_weight != null) {
    const p = goalProgress(goal.start_weight, last.kg, goal.weight_target);
    if (p) progress = { ...p, asOf: last.date, target: goal.weight_target, start: goal.start_weight };
  }
  return { last: last ?? null, movingAverage: ma, weeklyVariation: wv.delta, windows: { current: wv.cur, previous: wv.prev }, progress };
}

export function mountBody(r: Router) {
  r.get("/weights", ({ user, query }) => {
    const from = query.get("from") ? dateStr(query.get("from")) : undefined, to = query.get("to") ? dateStr(query.get("to")) : undefined;
    const entries = all(`SELECT * FROM weights WHERE user_id=? ${from ? "AND date>=?" : ""} ${to ? "AND date<=?" : ""} ORDER BY date DESC, time DESC`, ...[user.id, from, to].filter((x) => x !== undefined));
    return { entries, reference: refWeights(user.id, from, to) };
  });
  r.post("/weights", ({ user, body }) => {
    const date = dateStr(body.date);
    const kg = num(body.kg, "Poids (kg)", { min: 20, max: 400 });
    const time = body.time ? (/^\d{2}:\d{2}$/.test(body.time) ? body.time : (() => { throw bad("Heure invalide."); })()) : null;
    const id = uid();
    const hasRef = !!get("SELECT 1 x FROM weights WHERE user_id=? AND date=? AND is_ref=1", user.id, date);
    run("INSERT INTO weights(id,user_id,date,time,kg,note,is_ref,context,source,body_fat) VALUES(?,?,?,?,?,?,?,?,?,?)", id, user.id, date, time, kg,
      str(body.note, "Commentaire", 300, false) || null, hasRef ? 0 : 1, str(body.context, "Contexte", 60, false) || null, str(body.source, "Source", 60, false) || null, numOrNull(body.body_fat, "Masse grasse", { min: 1, max: 80 }));
    return { id, isReference: !hasRef };
  });
  r.put("/weights/:id", ({ user, params, body }) => {
    const w = get<any>("SELECT * FROM weights WHERE id=? AND user_id=?", params[0], user.id);
    if (!w) throw notFound();
    run("UPDATE weights SET kg=?, note=?, time=? WHERE id=?", body.kg != null ? num(body.kg, "Poids (kg)", { min: 20, max: 400 }) : w.kg, body.note !== undefined ? str(body.note, "Commentaire", 300, false) || null : w.note, body.time !== undefined ? body.time || null : w.time, w.id);
  });
  r.post("/weights/:id/reference", ({ user, params }) => {
    const w = get<any>("SELECT * FROM weights WHERE id=? AND user_id=?", params[0], user.id);
    if (!w) throw notFound();
    tx(() => { run("UPDATE weights SET is_ref=0 WHERE user_id=? AND date=?", user.id, w.date); run("UPDATE weights SET is_ref=1 WHERE id=?", w.id); });
  });
  r.del("/weights/:id", ({ user, params }) => {
    const w = get<any>("SELECT * FROM weights WHERE id=? AND user_id=?", params[0], user.id);
    if (!w) throw notFound();
    run("DELETE FROM weights WHERE id=?", w.id);
    if (w.is_ref) { const n = get<any>("SELECT id FROM weights WHERE user_id=? AND date=? ORDER BY time, id LIMIT 1", user.id, w.date); if (n) run("UPDATE weights SET is_ref=1 WHERE id=?", n.id); }
  });
  r.get("/weights-summary", ({ user, query }) => weightSummary(user.id, query.get("date") ? dateStr(query.get("date")) : todayIn(user.tz)));
  r.get("/measurements", ({ user }) => ({ entries: all("SELECT * FROM measurements WHERE user_id=? ORDER BY date DESC, name", user.id) }));
  r.post("/measurements", ({ user, body }) => {
    const id = uid();
    run("INSERT INTO measurements(id,user_id,date,name,cm) VALUES(?,?,?,?,?)", id, user.id, dateStr(body.date), str(body.name, "Nom", 40), num(body.cm, "Mesure (cm)", { min: 1, max: 400 }));
    return { id };
  });
  r.del("/measurements/:id", ({ user, params }) => { run("DELETE FROM measurements WHERE id=? AND user_id=?", params[0], user.id); });

  // --- profil de mode de vie versionné (PRO 01–03) ---
  r.get("/lifestyle", ({ user }) => {
    const cur = get<any>("SELECT * FROM lifestyle_versions WHERE user_id=? ORDER BY effective_from DESC, rowid DESC LIMIT 1", user.id);
    return { current: cur ? { ...cur, data: P(cur.data, {}) } : null, history: all("SELECT id,effective_from,origin FROM lifestyle_versions WHERE user_id=? ORDER BY effective_from DESC", user.id), equipmentOptions: EQUIPMENT };
  });
  r.post("/lifestyle", ({ user, body }) => {
    const d = body.data ?? {};
    const list = (v: unknown, n = 30) => (Array.isArray(v) ? v.slice(0, 40).map((x) => String(x).trim().slice(0, n)).filter(Boolean) : []);
    const data = {
      goal: str(d.goal, "Objectif", 40, false), level: ["débutant", "intermédiaire", "avancé", ""].includes(d.level) ? d.level : "",
      equipment: list(d.equipment).filter((x) => (EQUIPMENT as readonly string[]).includes(x)), gym: !!d.gym,
      sessions_per_week: numOrNull(d.sessions_per_week, "Séances par semaine", { min: 0, max: 14 }), max_session_min: numOrNull(d.max_session_min, "Durée max", { min: 5, max: 300 }),
      schedule: ["réguliers", "décalés", "variables", ""].includes(d.schedule) ? d.schedule : "", work: ["assis", "actif", ""].includes(d.work) ? d.work : "",
      meals_per_day: list(d.meal_categories ?? d.meals ?? []), excluded_foods: list(d.excluded_foods, 40), disliked_foods: list(d.disliked_foods, 40), liked_foods: list(d.liked_foods, 40),
      diet: str(d.diet, "Mode alimentaire", 60, false), eating_out: str(d.eating_out, "Repas à l'extérieur", 60, false),
      budget: ["serré", "moyen", "souple", ""].includes(d.budget) ? d.budget : "", cook_time_max_min: numOrNull(d.cook_time_max_min, "Temps de préparation max", { min: 0, max: 300 }),
      people: numOrNull(d.people, "Convives", { min: 1, max: 20 }), kitchen_equipment: list(d.kitchen_equipment),
      temp_mode: ["", "déplacement", "vacances", "semaine chargée", "reprise"].includes(d.temp_mode) ? d.temp_mode : "",
      allergies: list(d.allergies, 40), // informations sensibles facultatives : filtre, sans garantie sur les traces
      coaching: { style: str(d.coaching?.style, "Style", 40, false), review_frequency: str(d.coaching?.review_frequency, "Fréquence", 40, false), detail: str(d.coaching?.detail, "Détail", 40, false), silent: !!d.coaching?.silent },
    };
    const effective = body.effective_from ? dateStr(body.effective_from) : todayIn(user.tz);
    const id = uid();
    run("INSERT INTO lifestyle_versions(id,user_id,data,effective_from,origin) VALUES(?,?,?,?,?)", id, user.id, J(data), effective, "declared");
    run("UPDATE users SET equipment=? WHERE id=?", J(data.equipment), user.id);
    return { id };
  });
}
export const currentLifestyle = (userId: string) => P<any>(get<any>("SELECT data FROM lifestyle_versions WHERE user_id=? ORDER BY effective_from DESC, rowid DESC LIMIT 1", userId)?.data, {});
