import { Router, dateStr, todayIn, P } from "../http";
import { all, get } from "../db";
import { weekSummary, addDays, adherence, strengthVolume, type DaySummary } from "../calc";
import { dayInfo, activeGoal } from "./nutrition";
import { refWeights, weightSummary } from "./body";
import { setLikes } from "./training";

export function weekData(userId: string, end: string) {
  const start = addDays(end, -6);
  const days: DaySummary[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const info = dayInfo(userId, d);
    days.push({ date: d, state: info.state, kcal: info.totals.kcal, protein: info.totals.protein, kcalComplete: info.kcalComplete, proteinComplete: info.proteinComplete });
  }
  const summary = weekSummary(days, 7);
  const workouts = all<any>("SELECT state FROM workouts WHERE user_id=? AND date>=? AND date<=? AND state IN ('terminee','interrompue')", userId, start, end);
  // Une activité liée à une séance n'est pas comptée deux fois dans le nombre d'entraînements.
  const acts = all<any>("SELECT * FROM activities WHERE user_id=? AND date>=? AND date<=?", userId, start, end);
  const planned = all<any>("SELECT status FROM planned WHERE user_id=? AND date>=? AND date<=?", userId, start, end);
  const trainings = workouts.filter((w) => w.state === "terminee").length + acts.filter((a) => !a.workout_id).length;
  return {
    start, end, days, summary,
    trainings: { completed: workouts.filter((w) => w.state === "terminee").length, interrupted: workouts.filter((w) => w.state === "interrompue").length, activities: acts.length, total: trainings, activityMinutes: acts.reduce((a, x) => a + (x.duration_min ?? 0), 0) },
    adherence: adherence(planned), weight: weightSummary(userId, end),
  };
}

/** Records (STA 02) : charge à répétitions comparables, répétitions à charge identique, durée/distance. Échauffements exclus. */
export function records(userId: string) {
  const sets = all<any>(`SELECT s.*, w.date FROM sets s JOIN workouts w ON w.id=s.workout_id WHERE s.user_id=? AND s.kind='work' AND w.state IN ('terminee','interrompue') ORDER BY w.started_at`, userId);
  const out = new Map<string, any>();
  const consider = (key: string, label: string, ctx: any, value: number, s: any, unit: string) => {
    const cur = out.get(key);
    if (!cur || value > cur.value) out.set(key, { key, exercise: s.exercise_name, label, context: ctx, value, unit, date: s.date, set_id: s.id });
  };
  for (const s of sets) {
    if (s.bodyweight || s.assisted) { // performances au poids du corps / assistées : séparées des charges externes
      if (s.reps) consider(`${s.exercise_id}|bw|reps`, "Répétitions (poids du corps/assisté)", { type: s.assisted ? "assisté" : "poids du corps" }, s.reps, s, "reps");
      continue;
    }
    const ctx = { equipment: s.equipment_ctx ?? "", conv: s.load_conv ?? "" };
    const base = `${s.exercise_id}|${ctx.equipment}|${ctx.conv}`;
    if (s.load != null && s.reps) {
      consider(`${base}|load@${s.reps}`, `Charge max à ${s.reps} rép.`, ctx, s.load, s, "kg");
      consider(`${base}|reps@${s.load}`, `Répétitions max à ${s.load} kg`, ctx, s.reps, s, "reps");
    }
    if (s.secs) consider(`${s.exercise_id}|secs`, "Durée max", ctx, s.secs, s, "s");
    if (s.distance) consider(`${s.exercise_id}|dist`, "Distance max", ctx, s.distance, s, "km");
  }
  return [...out.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function mountStats(r: Router) {
  r.get("/stats/today", ({ user, query }) => {
    const date = query.get("date") ? dateStr(query.get("date")) : todayIn(user.tz);
    const planned = all<any>("SELECT p.*, (SELECT name FROM routines WHERE routine_key=p.routine_key ORDER BY version DESC LIMIT 1) routine_name FROM planned p WHERE user_id=? AND date=? AND status IN ('prevu','reporte')", user.id, date);
    const active = get<any>("SELECT id,name,started_at FROM workouts WHERE user_id=? AND state='en_cours'", user.id);
    const w = weightSummary(user.id, date);
    const todayWeights = all<any>("SELECT id,kg,time,is_ref FROM weights WHERE user_id=? AND date=?", user.id, date);
    const priorities = all<any>("SELECT id,payload,rationale FROM proposals WHERE user_id=? AND kind='week_priorities' AND status='accepted' ORDER BY decided_at DESC LIMIT 1", user.id).map((p) => ({ id: p.id, items: P<any>(p.payload, {}).items ?? [] }))[0] ?? null;
    return { date, day: dayInfo(user.id, date), planned, activeWorkout: active ?? null, weight: w, todayWeights, goal: activeGoal(user.id, date), priorities };
  });
  r.get("/stats/week", ({ user, query }) => weekData(user.id, query.get("end") ? dateStr(query.get("end")) : todayIn(user.tz)));

  r.get("/stats/series", ({ user, query }) => {
    const today = todayIn(user.tz);
    const range = query.get("range") ?? "30";
    const to = query.get("to") ? dateStr(query.get("to")) : today;
    const from = query.get("from") ? dateStr(query.get("from")) : addDays(to, -(Number(range) || 30) + 1);
    // Poids mesuré + moyenne mobile avec nombre de mesures ; aucun jour fictif.
    const ref = refWeights(user.id, addDays(from, -6), to);
    const weights = ref.filter((p) => p.date >= from).map((p) => {
      const win = ref.filter((x) => x.date >= addDays(p.date, -6) && x.date <= p.date);
      return { date: p.date, kg: p.kg, avg: win.length >= 3 ? win.reduce((a, x) => a + x.kg, 0) / win.length : null, n: win.length };
    });
    const intake = [] as any[];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const i = dayInfo(user.id, d);
      if (i.state === "non_renseignee") intake.push({ date: d, state: i.state, kcal: null, target: activeGoal(user.id, d)?.kcal ?? null });
      else intake.push({ date: d, state: i.state, kcal: i.totals.kcal, protein: i.totals.protein, complete: i.state === "terminee" && i.kcalComplete, target: i.goal?.kcal ?? null });
    }
    // Séances et durée d'activité par semaine (début lundi).
    const weeks = new Map<string, { week: string; sessions: number; minutes: number }>();
    const mon = (d: string) => { const x = new Date(d + "T00:00:00Z"); const k = (x.getUTCDay() + 6) % 7; return addDays(d, -k); };
    for (const w of all<any>("SELECT id,date,started_at,ended_at,state FROM workouts WHERE user_id=? AND date>=? AND date<=? AND state IN ('terminee')", user.id, from, to)) {
      const k = mon(w.date); const e = weeks.get(k) ?? { week: k, sessions: 0, minutes: 0 };
      e.sessions++; e.minutes += Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000); weeks.set(k, e);
    }
    for (const a of all<any>("SELECT date,duration_min FROM activities WHERE user_id=? AND date>=? AND date<=? AND workout_id IS NULL", user.id, from, to)) {
      const k = mon(a.date); const e = weeks.get(k) ?? { week: k, sessions: 0, minutes: 0 };
      e.sessions++; e.minutes += a.duration_min ?? 0; weeks.set(k, e);
    }
    let exercise: any[] = [];
    const ex = query.get("exercise");
    if (ex) {
      const rows = all<any>(`SELECT s.*, w.date FROM sets s JOIN workouts w ON w.id=s.workout_id WHERE s.user_id=? AND s.exercise_id IN (SELECT id FROM exercises WHERE ex_key=?) AND s.kind='work' AND w.date>=? AND w.date<=? ORDER BY w.started_at, s.idx`, user.id, ex, from, to);
      const key = (s: any) => `${s.equipment_ctx ?? ""}|${s.load_conv ?? ""}|${s.bodyweight ? "pc" : s.assisted ? "as" : "ext"}`; // contexte comparable
      const byCtx = new Map<string, any[]>();
      for (const s of rows) byCtx.set(key(s), [...(byCtx.get(key(s)) ?? []), s]);
      exercise = [...byCtx.entries()].map(([ctx, ss]) => {
        const byDate = new Map<string, any[]>();
        for (const s of ss) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
        return { context: ctx, points: [...byDate.entries()].map(([date, x]) => ({ date, maxLoad: Math.max(...x.map((s) => s.load ?? 0)), bestReps: Math.max(...x.map((s) => s.reps ?? 0)), volume: strengthVolume(setLikes(x)).external })) };
      });
    }
    return { from, to, weights, intake, weeks: [...weeks.values()].sort((a, b) => (a.week < b.week ? -1 : 1)), exercise };
  });
  r.get("/stats/records", ({ user }) => ({ records: records(user.id) }));
}
