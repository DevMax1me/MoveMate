import { Router, bad, notFound, str, num, numOrNull, dateStr, J, P, todayIn, checkVersion } from "../http";
import { all, get, run, tx, uid, nowIso } from "../db";
import { compatible, missing } from "../equipment";
import { strengthVolume, type SetLike } from "../calc";
import { ApiError, type User } from "../auth";

export type ExRow = { id: string; ex_key: string; version: number; user_id: string | null; name: string; alias: string | null; movement: string; primary_muscles: string; secondary_muscles: string; place: string; equipment: string; level: string; metric: "reps_load" | "time" | "distance"; steps: string | null; mistakes: string | null; easier: string | null; alternative: string | null; media_url: string | null; media_author: string | null; media_source: string | null; media_license: string | null; status: string; archived: number };

export const latestEx = (userId: string, key: string) => get<ExRow>("SELECT * FROM exercises WHERE ex_key=? AND (user_id IS NULL OR user_id=?) AND status='published' ORDER BY version DESC LIMIT 1", key, userId);
const exOut = (e: ExRow, user: User) => {
  const equipment = P<string[]>(e.equipment, []);
  const prof = P<string[]>(user.equipment, []);
  return { ...e, primary_muscles: P(e.primary_muscles, []), secondary_muscles: P(e.secondary_muscles, []), equipment, private: e.user_id != null, compatible: compatible(equipment, prof, false), missing: missing(equipment, prof, false) };
};

export function mountTraining(r: Router) {
  // --- catalogue ---
  r.get("/exercises", ({ user, query }) => {
    const q = (query.get("q") ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const place = query.get("place"), muscle = query.get("muscle"), eq = query.get("equipment"), level = query.get("level"), type = query.get("type");
    const rows = all<ExRow>(`SELECT * FROM exercises e WHERE (user_id IS NULL OR user_id=?) AND archived=0 AND status='published'
      AND version=(SELECT MAX(version) FROM exercises x WHERE x.ex_key=e.ex_key AND (x.user_id IS NULL OR x.user_id=?) AND x.status='published') ORDER BY name`, user.id, user.id);
    const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    let out = rows.map((e) => exOut(e, user)).filter((e) =>
      (!q || q.split(/\s+/).every((w: string) => n(e.name + " " + (e.alias ?? "") + " " + e.primary_muscles.join(" ") + " " + e.movement).includes(w))) &&
      (!place || (place === "home" ? e.place !== "gym" : place === "gym" ? e.place !== "home" : true)) &&
      (!muscle || e.primary_muscles.some((m: string) => n(m).includes(n(muscle))) || e.secondary_muscles.some((m: string) => n(m).includes(n(muscle)))) &&
      (!eq || (eq === "none" ? e.equipment.length === 0 : e.equipment.some((x: string) => x.includes(eq)))) &&
      (!level || e.level === level) && (!type || e.movement === type));
    if (query.get("compatible") === "1") out = out.filter((e) => e.compatible);
    return { exercises: out };
  });
  r.get("/exercises/:key", ({ user, params }) => {
    const e = latestEx(user.id, params[0]);
    if (!e) throw notFound();
    const x = exOut(e, user);
    const alt = e.alternative ? latestEx(user.id, e.alternative) : null, easier = e.easier ? latestEx(user.id, e.easier) : null;
    return { exercise: x, alternative: alt && exOut(alt, user), easier: easier && exOut(easier, user) };
  });
  r.post("/exercises", ({ user, body }) => {
    const id = uid(), key = "u-" + uid();
    const metric = ["reps_load", "time", "distance"].includes(body.metric) ? body.metric : "reps_load";
    run(`INSERT INTO exercises(id,ex_key,version,user_id,name,alias,movement,primary_muscles,secondary_muscles,place,equipment,level,metric,steps,mistakes,status)
      VALUES(?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,'published')`, id, key, user.id, str(body.name, "Nom", 100), str(body.alias, "Alias", 100, false) || null, str(body.movement ?? "autre", "Mouvement", 40),
      J(arr(body.primary_muscles)), J(arr(body.secondary_muscles)), ["home", "gym", "both"].includes(body.place) ? body.place : "both", J(arr(body.equipment)), body.level ?? "débutant", metric, str(body.steps, "Étapes", 3000, false) || null, str(body.mistakes, "Erreurs", 1000, false) || null);
    return { id, ex_key: key };
  });
  // Modifier ou archiver une fiche n'altère pas les séances historiques (snapshot + id de version).
  r.put("/exercises/:key", ({ user, params, body }) => {
    const e = latestEx(user.id, params[0]);
    if (!e || e.user_id !== user.id) throw notFound();
    checkVersion(body, e.version);
    const id = uid();
    run(`INSERT INTO exercises(id,ex_key,version,user_id,name,alias,movement,primary_muscles,secondary_muscles,place,equipment,level,metric,steps,mistakes,easier,alternative,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published')`, id, e.ex_key, e.version + 1, user.id, body.name ? str(body.name, "Nom", 100) : e.name, e.alias, body.movement ?? e.movement,
      body.primary_muscles ? J(arr(body.primary_muscles)) : e.primary_muscles, e.secondary_muscles, body.place ?? e.place, body.equipment ? J(arr(body.equipment)) : e.equipment, body.level ?? e.level, e.metric,
      body.steps !== undefined ? str(body.steps, "Étapes", 3000, false) : e.steps, body.mistakes !== undefined ? str(body.mistakes, "Erreurs", 1000, false) : e.mistakes, e.easier, e.alternative);
    return { id, version: e.version + 1 };
  });
  r.del("/exercises/:key", ({ user, params }) => {
    const e = latestEx(user.id, params[0]);
    if (!e || e.user_id !== user.id) throw notFound();
    run("UPDATE exercises SET archived=1 WHERE ex_key=? AND user_id=?", e.ex_key, user.id);
  });
  r.get("/exercises/:key/history", ({ user, params }) => {
    const rows = all<any>(`SELECT s.*, w.date, w.started_at FROM sets s JOIN workouts w ON w.id=s.workout_id WHERE s.user_id=? AND s.exercise_id IN (SELECT id FROM exercises WHERE ex_key=?) AND s.kind='work' AND w.state IN ('terminee','interrompue','en_cours') ORDER BY w.started_at, s.idx`, user.id, params[0]);
    return { sets: rows, contexts: [...new Set(rows.map((x) => `${x.equipment_ctx ?? ""}|${x.load_conv ?? ""}`))] };
  });

  // --- routines ---
  const routineOut = (ro: any, user: User) => {
    const items = P<any[]>(ro.items, []).map((it) => { const e = latestEx(user.id, it.slug); return { ...it, name: e?.name ?? it.slug, compatible: e ? exOut(e, user).compatible : false, missing: e ? exOut(e, user).missing : [], alternative: e?.alternative ?? null }; });
    return { ...ro, items };
  };
  const itemsInput = (user: User, v: unknown) => {
    if (!Array.isArray(v) || !v.length) throw bad("Ajoutez au moins un exercice.");
    return v.slice(0, 40).map((it: any) => {
      const e = latestEx(user.id, String(it.slug ?? ""));
      if (!e) throw bad("Exercice inconnu dans la routine.");
      return { slug: e.ex_key, sets: num(it.sets ?? 3, "Séries", { min: 1, max: 20 }), warmup_sets: num(it.warmup_sets ?? 0, "Séries d'échauffement", { min: 0, max: 10 }),
        reps: str(it.reps, "Répétitions", 20, false), load: numOrNull(it.load, "Charge", { min: 0, max: 1000 }), duration_s: numOrNull(it.duration_s, "Durée", { min: 1, max: 7200 }), distance_km: numOrNull(it.distance_km, "Distance", { min: 0, max: 1000 }),
        rest: num(it.rest ?? 60, "Repos", { min: 0, max: 1200 }), intensity: str(it.intensity, "Intensité", 40, false), notes: str(it.notes, "Notes", 300, false) };
    });
  };
  r.get("/routines", ({ user }) => {
    const mine = all<any>("SELECT * FROM routines r WHERE user_id=? AND archived=0 AND version=(SELECT MAX(version) FROM routines x WHERE x.routine_key=r.routine_key AND x.user_id=r.user_id) ORDER BY name", user.id);
    const demos = all<any>("SELECT * FROM routines WHERE demo=1 ORDER BY name");
    return { routines: mine.map((x) => routineOut(x, user)), demos: demos.map((x) => routineOut(x, user)) };
  });
  r.post("/routines", ({ user, body }) => {
    const id = uid(), key = "ro-" + uid();
    run("INSERT INTO routines(id,routine_key,version,user_id,name,place,items,created_at) VALUES(?,?,1,?,?,?,?,?)", id, key, user.id, str(body.name, "Nom", 100), ["home", "gym"].includes(body.place) ? body.place : "home", J(itemsInput(user, body.items)), nowIso());
    return { id, routine_key: key };
  });
  r.put("/routines/:key", ({ user, params, body }) => {
    const cur = get<any>("SELECT * FROM routines WHERE routine_key=? AND user_id=? ORDER BY version DESC LIMIT 1", params[0], user.id);
    if (!cur) throw notFound();
    checkVersion(body, cur.version);
    const id = uid();
    run("INSERT INTO routines(id,routine_key,version,user_id,name,place,items,created_at) VALUES(?,?,?,?,?,?,?,?)", id, cur.routine_key, cur.version + 1, user.id, body.name ? str(body.name, "Nom", 100) : cur.name, ["home", "gym"].includes(body.place) ? body.place : cur.place, body.items ? J(itemsInput(user, body.items)) : cur.items, nowIso());
    return { id, version: cur.version + 1 };
  });
  r.post("/routines/:key/duplicate", ({ user, params }) => {
    const cur = get<any>("SELECT * FROM routines WHERE routine_key=? AND (user_id=? OR demo=1) ORDER BY version DESC LIMIT 1", params[0], user.id);
    if (!cur) throw notFound();
    const id = uid(), key = "ro-" + uid();
    run("INSERT INTO routines(id,routine_key,version,user_id,name,place,items,demo,created_at) VALUES(?,?,1,?,?,?,?,0,?)", id, key, user.id, cur.name.replace(/^Démo — /, "") + " (copie)", cur.place, cur.items, nowIso());
    return { id, routine_key: key };
  });
  r.del("/routines/:key", ({ user, params }) => { run("UPDATE routines SET archived=1 WHERE routine_key=? AND user_id=?", params[0], user.id); });

  // --- planning simple ---
  r.get("/planned", ({ user, query }) => {
    const from = dateStr(query.get("from")), to = dateStr(query.get("to"));
    const rows = all<any>(`SELECT p.*, (SELECT name FROM routines WHERE routine_key=p.routine_key ORDER BY version DESC LIMIT 1) routine_name FROM planned p WHERE user_id=? AND date>=? AND date<=? ORDER BY date`, user.id, from, to);
    return { planned: rows };
  });
  r.post("/planned", ({ user, body }) => {
    const key = str(body.routine_key, "Routine", 60);
    if (!get("SELECT 1 x FROM routines WHERE routine_key=? AND (user_id=? OR demo=1)", key, user.id)) throw notFound("Routine introuvable.");
    const date = dateStr(body.date);
    const weeks = body.weekly ? Math.min(Math.max(Number(body.weeks) || 12, 1), 52) : 1;
    const series = weeks > 1 ? uid() : null;
    const ids: string[] = [];
    tx(() => {
      for (let i = 0; i < weeks; i++) {
        const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 7 * i);
        const id = uid(); ids.push(id);
        run("INSERT INTO planned(id,user_id,routine_key,date,series_id,weekday,status) VALUES(?,?,?,?,?,?,'prevu')", id, user.id, key, d.toISOString().slice(0, 10), series, d.getUTCDay());
      }
    });
    return { ids, series };
  });
  // Déplacer une occurrence ne change pas les autres ; la récurrence s'applique aux occurrences futures dès une date.
  r.put("/planned/:id", ({ user, params, body }) => {
    const p = get<any>("SELECT * FROM planned WHERE id=? AND user_id=?", params[0], user.id);
    if (!p) throw notFound();
    const status = body.status ? (["prevu", "realise", "reporte", "annule"].includes(body.status) ? body.status : (() => { throw bad("Statut invalide."); })()) : p.status;
    if (body.scope === "future" && p.series_id) {
      const routine = body.routine_key ? str(body.routine_key, "Routine", 60) : p.routine_key;
      run("UPDATE planned SET routine_key=?, status=CASE WHEN status='realise' THEN status ELSE ? END WHERE series_id=? AND date>=? AND user_id=? AND status<>'realise'", routine, status, p.series_id, p.date, user.id);
      return;
    }
    run("UPDATE planned SET date=?, status=?, routine_key=? WHERE id=?", body.date ? dateStr(body.date) : p.date, status, body.routine_key ? str(body.routine_key, "Routine", 60) : p.routine_key, p.id);
  });
  r.del("/planned/:id", ({ user, params, query }) => {
    const p = get<any>("SELECT * FROM planned WHERE id=? AND user_id=?", params[0], user.id);
    if (!p) return;
    if (query.get("scope") === "future" && p.series_id) run("DELETE FROM planned WHERE series_id=? AND date>=? AND user_id=? AND status<>'realise'", p.series_id, p.date, user.id);
    else run("DELETE FROM planned WHERE id=?", p.id);
  });

  // --- séances ---
  const activeWorkout = (userId: string) => get<any>("SELECT * FROM workouts WHERE user_id=? AND state='en_cours'", userId);
  const workoutFull = (user: User, w: any) => {
    const sets = all<any>("SELECT s.*, (SELECT ex_key FROM exercises WHERE id=s.exercise_id) ex_key, (SELECT metric FROM exercises WHERE id=s.exercise_id) metric FROM sets s WHERE workout_id=? ORDER BY idx, created_at", w.id);
    const snap = P<any>(w.snapshot, { items: [] });
    // Dernières performances comparables (SEA 05) : même exercice, même matériel, même convention de charge.
    const prev = snap.items.map((it: any) => ({ slug: it.slug, last: lastComparable(user.id, it.slug, w.id) }));
    return { ...w, snapshot: snap, sets, previous: prev, restRemainingMs: w.rest_until ? Math.max(0, w.rest_until - Date.now()) : 0 };
  };
  r.get("/workouts/active", ({ user }) => {
    const w = activeWorkout(user.id);
    return { workout: w ? workoutFull(user, w) : null };
  });
  r.get("/workouts", ({ user, query }) => {
    const lim = Math.min(Number(query.get("limit")) || 30, 200);
    const rows = all<any>("SELECT * FROM workouts WHERE user_id=? AND state<>'brouillon' ORDER BY started_at DESC LIMIT ?", user.id, lim);
    return { workouts: rows.map((w) => ({ ...w, snapshot: undefined, summary: summarize(w.id) })) };
  });
  r.post("/workouts/start", ({ user, body }) => {
    const idem = str(body.idem, "Clé d'idempotence", 80, false) || null;
    if (idem) { const ex = get<any>("SELECT * FROM workouts WHERE user_id=? AND idem=?", user.id, idem); if (ex) return { workout: workoutFull(user, ex), replay: true }; }
    const act = activeWorkout(user.id);
    if (act) throw new ApiError(409, "Une séance est déjà en cours.", { workout_id: act.id });
    let name = "Séance libre", place: string | null = body.place ?? null, items: any[] = [];
    let routine_key: string | null = null, routine_version: number | null = null;
    if (body.routine_key) {
      const ro = get<any>("SELECT * FROM routines WHERE routine_key=? AND (user_id=? OR demo=1) ORDER BY version DESC LIMIT 1", str(body.routine_key, "Routine", 60), user.id);
      if (!ro) throw notFound("Routine introuvable.");
      name = ro.name; place = ro.place; routine_key = ro.routine_key; routine_version = ro.version;
      // Copie figée de la routine ET de ses exercices (ROU 05).
      items = P<any[]>(ro.items, []).map((it) => { const e = latestEx(user.id, it.slug); return { ...it, exercise_id: e?.id, name: e?.name ?? it.slug, metric: e?.metric ?? "reps_load", equipment: P(e?.equipment, []) }; });
    }
    const date = todayIn(user.tz), id = uid();
    tx(() => {
      run("INSERT INTO workouts(id,user_id,name,state,place,snapshot,started_at,date,planned_id,idem,updated_at) VALUES(?,?,?,'en_cours',?,?,?,?,?,?,?)", id, user.id, name, place, J({ items, routine_key, routine_version }), nowIso(), date, body.planned_id ?? null, idem, nowIso());
    });
    return { workout: workoutFull(user, get<any>("SELECT * FROM workouts WHERE id=?", id)), replay: false };
  });
  r.post("/workouts/:id/sets", ({ user, params, body }) => {
    const w = get<any>("SELECT * FROM workouts WHERE id=? AND user_id=?", params[0], user.id);
    if (!w) throw notFound();
    if (w.state !== "en_cours" && !body.correction) throw bad("La séance n'est plus en cours.");
    const idem = str(body.idem, "Clé d'idempotence", 80, false) || null;
    if (idem) { const ex = get<any>("SELECT * FROM sets WHERE user_id=? AND idem=?", user.id, idem); if (ex) return { set: ex, replay: true }; } // T13
    const e = latestEx(user.id, str(body.exercise_key, "Exercice", 60));
    if (!e) throw notFound("Exercice introuvable.");
    const snapItem = P<any>(w.snapshot, { items: [] }).items.find((i: any) => i.slug === e.ex_key);
    const exerciseId = snapItem?.exercise_id ?? e.id;
    const idx = (get<any>("SELECT COALESCE(MAX(idx),0)+1 n FROM sets WHERE workout_id=?", w.id)?.n) ?? 1;
    const id = uid();
    const kind = body.kind === "warmup" ? "warmup" : "work";
    run(`INSERT INTO sets(id,workout_id,user_id,exercise_id,exercise_name,equipment_ctx,idx,kind,reps,load,load_conv,secs,distance,rpe,rir,side,bodyweight,assisted,confirmed_default,idem,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, w.id, user.id, exerciseId, e.name, str(body.equipment_ctx, "Appareil", 80, false) || null, idx, kind,
      numOrNull(body.reps, "Répétitions", { min: 0, max: 1000 }), numOrNull(body.load, "Charge", { min: 0, max: 2000 }), ["total", "par_haltere", "machine", ""].includes(body.load_conv ?? "") ? body.load_conv || null : null,
      numOrNull(body.secs, "Durée", { min: 0, max: 86400 }), numOrNull(body.distance, "Distance", { min: 0, max: 10000 }), numOrNull(body.rpe, "Effort perçu", { min: 1, max: 10 }), numOrNull(body.rir, "Répétitions en réserve", { min: 0, max: 20 }),
      ["gauche", "droite", "deux", ""].includes(body.side ?? "") ? body.side || null : null, +!!body.bodyweight, +!!body.assisted, +!!body.confirmed_default, idem, nowIso());
    const rest = body.rest_s != null ? Number(body.rest_s) : (snapItem?.rest ?? 0);
    if (rest > 0 && w.state === "en_cours") run("UPDATE workouts SET rest_until=?, updated_at=? WHERE id=?", Date.now() + rest * 1000, nowIso(), w.id); // minuteur calculé depuis une heure de fin (SEA 03)
    return { set: get("SELECT * FROM sets WHERE id=?", id), replay: false, rest_until: rest > 0 ? Date.now() + rest * 1000 : null };
  });
  r.put("/sets/:id", ({ user, params, body }) => {
    const s = get<any>("SELECT * FROM sets WHERE id=? AND user_id=?", params[0], user.id);
    if (!s) throw notFound();
    run("UPDATE sets SET reps=?,load=?,secs=?,distance=?,rpe=?,rir=?,kind=?,bodyweight=?,assisted=?,load_conv=?,updated_at=? WHERE id=?",
      body.reps !== undefined ? numOrNull(body.reps, "Répétitions", { min: 0 }) : s.reps, body.load !== undefined ? numOrNull(body.load, "Charge", { min: 0 }) : s.load, body.secs !== undefined ? numOrNull(body.secs, "Durée", { min: 0 }) : s.secs,
      body.distance !== undefined ? numOrNull(body.distance, "Distance", { min: 0 }) : s.distance, body.rpe !== undefined ? numOrNull(body.rpe, "Effort", { min: 1, max: 10 }) : s.rpe, body.rir !== undefined ? numOrNull(body.rir, "RIR", { min: 0 }) : s.rir,
      body.kind ? (body.kind === "warmup" ? "warmup" : "work") : s.kind, body.bodyweight !== undefined ? +!!body.bodyweight : s.bodyweight, body.assisted !== undefined ? +!!body.assisted : s.assisted, body.load_conv !== undefined ? body.load_conv || null : s.load_conv, nowIso(), s.id);
    run("UPDATE workouts SET updated_at=? WHERE id=?", nowIso(), s.workout_id);
  });
  r.del("/sets/:id", ({ user, params }) => { run("DELETE FROM sets WHERE id=? AND user_id=?", params[0], user.id); });
  r.post("/workouts/:id/rest", ({ user, params, body }) => {
    const w = get<any>("SELECT id FROM workouts WHERE id=? AND user_id=?", params[0], user.id);
    if (!w) throw notFound();
    const s = body.stop ? null : Date.now() + num(body.seconds, "Repos", { min: 1, max: 1800 }) * 1000;
    run("UPDATE workouts SET rest_until=? WHERE id=?", s, w.id);
    return { rest_until: s };
  });
  r.post("/workouts/:id/finish", ({ user, params, body }) => {
    const w = get<any>("SELECT * FROM workouts WHERE id=? AND user_id=?", params[0], user.id);
    if (!w) throw notFound();
    const state = body.state === "interrompue" ? "interrompue" : "terminee";
    run("UPDATE workouts SET state=?, ended_at=?, rest_until=NULL, updated_at=? WHERE id=?", state, nowIso(), nowIso(), w.id);
    // Une séance prévue mais non faite ne crée pas de séance réalisée ; seule une séance terminée marque la prévue comme réalisée.
    if (state === "terminee" && w.planned_id) run("UPDATE planned SET status='realise', workout_id=? WHERE id=? AND user_id=?", w.id, w.planned_id, user.id);
    return workoutSummary(user, w.id);
  });
  r.get("/workouts/:id", ({ user, params }) => {
    const w = get<any>("SELECT id FROM workouts WHERE id=? AND user_id=?", params[0], user.id);
    if (!w) throw notFound();
    return workoutSummary(user, w.id);
  });
  r.del("/workouts/:id", ({ user, params }) => { run("DELETE FROM workouts WHERE id=? AND user_id=?", params[0], user.id); });

  // --- activités hors musculation ---
  r.get("/activities", ({ user, query }) => {
    const from = query.get("from") ? dateStr(query.get("from")) : "0000-01-01", to = query.get("to") ? dateStr(query.get("to")) : "9999-12-31";
    return { activities: all("SELECT * FROM activities WHERE user_id=? AND date>=? AND date<=? ORDER BY date DESC", user.id, from, to) };
  });
  r.post("/activities", ({ user, body }) => {
    const id = uid();
    const src = body.energy_kcal != null && body.energy_kcal !== "" ? (["montre", "machine", "estimation personnelle"].includes(body.energy_source) ? body.energy_source : "estimation personnelle") : null;
    run("INSERT INTO activities(id,user_id,type,date,duration_min,distance_km,steps,rpe,note,workout_id,energy_kcal,energy_source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", id, user.id, str(body.type, "Type", 40), dateStr(body.date),
      numOrNull(body.duration_min, "Durée", { min: 0, max: 1440 }), numOrNull(body.distance_km, "Distance", { min: 0, max: 5000 }), numOrNull(body.steps, "Pas", { min: 0, max: 200000 }), numOrNull(body.rpe, "Intensité", { min: 1, max: 10 }),
      str(body.note, "Commentaire", 300, false) || null, body.workout_id && get("SELECT 1 x FROM workouts WHERE id=? AND user_id=?", body.workout_id, user.id) ? body.workout_id : null, numOrNull(body.energy_kcal, "Dépense", { min: 0, max: 20000 }), src);
    return { id };
  });
  r.put("/activities/:id", ({ user, params, body }) => {
    const a = get<any>("SELECT * FROM activities WHERE id=? AND user_id=?", params[0], user.id);
    if (!a) throw notFound();
    run("UPDATE activities SET type=?,date=?,duration_min=?,distance_km=?,steps=?,rpe=?,note=? WHERE id=?", body.type ? str(body.type, "Type", 40) : a.type, body.date ? dateStr(body.date) : a.date,
      body.duration_min !== undefined ? numOrNull(body.duration_min, "Durée", { min: 0 }) : a.duration_min, body.distance_km !== undefined ? numOrNull(body.distance_km, "Distance", { min: 0 }) : a.distance_km,
      body.steps !== undefined ? numOrNull(body.steps, "Pas", { min: 0 }) : a.steps, body.rpe !== undefined ? numOrNull(body.rpe, "Intensité", { min: 1, max: 10 }) : a.rpe, body.note !== undefined ? str(body.note, "Commentaire", 300, false) || null : a.note, a.id);
  });
  r.del("/activities/:id", ({ user, params }) => { run("DELETE FROM activities WHERE id=? AND user_id=?", params[0], user.id); });
}

const arr = (v: unknown) => (Array.isArray(v) ? v.slice(0, 20).map((x) => String(x).trim().slice(0, 40)).filter(Boolean) : typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);

/** Dernière séance comparable : même exercice, même matériel, même convention de charge (SEA 05). */
export function lastComparable(userId: string, slug: string, excludeWorkout?: string) {
  const last = get<any>(`SELECT s.workout_id, s.equipment_ctx, s.load_conv, w.date FROM sets s JOIN workouts w ON w.id=s.workout_id
    WHERE s.user_id=? AND s.exercise_id IN (SELECT id FROM exercises WHERE ex_key=?) AND s.kind='work' AND s.workout_id<>? ORDER BY w.started_at DESC, s.idx DESC LIMIT 1`, userId, slug, excludeWorkout ?? "");
  if (!last) return null;
  const sets = all<any>("SELECT reps,load,secs,distance,load_conv,equipment_ctx FROM sets WHERE workout_id=? AND exercise_id IN (SELECT id FROM exercises WHERE ex_key=?) AND kind='work' ORDER BY idx", last.workout_id, slug);
  return { date: last.date, equipment_ctx: last.equipment_ctx, load_conv: last.load_conv, sets };
}

export function setLikes(rows: any[]): SetLike[] {
  return rows.map((s) => ({ kind: s.kind, reps: s.reps, load: s.load, bodyweight: !!s.bodyweight, assisted: !!s.assisted, bilateralDumbbells: s.load_conv === "par_haltere" }));
}
export function summarize(workoutId: string) {
  const w = get<any>("SELECT * FROM workouts WHERE id=?", workoutId);
  const sets = all<any>("SELECT * FROM sets WHERE workout_id=? ORDER BY idx", workoutId);
  const end = w.ended_at ? Date.parse(w.ended_at) : Date.now();
  const v = strengthVolume(setLikes(sets));
  return { duration_min: Math.round((end - Date.parse(w.started_at)) / 60000), exercises: new Set(sets.map((s) => s.exercise_name)).size, sets: sets.length, workSets: sets.filter((s) => s.kind === "work").length, volume: v.external, bodyweightSets: v.bodyweightSets };
}
function workoutSummary(user: User, id: string) {
  const w = get<any>("SELECT * FROM workouts WHERE id=?", id);
  const sets = all<any>("SELECT * FROM sets WHERE workout_id=? ORDER BY idx", id);
  const byEx = new Map<string, any[]>();
  for (const s of sets) byEx.set(s.exercise_name, [...(byEx.get(s.exercise_name) ?? []), s]);
  const snap = P<any>(w.snapshot, { items: [] });
  return { workout: { ...w, snapshot: snap }, summary: summarize(id), exercises: [...byEx.entries()].map(([name, ss]) => ({ name, sets: ss, volume: strengthVolume(setLikes(ss)) })), by: user.id && undefined };
}
